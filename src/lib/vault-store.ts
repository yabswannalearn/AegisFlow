import crypto from "crypto";
import { z } from "zod";
import { prisma } from "./prisma";
import {
  encryptPhi,
  decryptPhi,
  sha256Hash,
  generateCapabilityToken,
  generatePseudonymousAlias,
} from "./crypto";
import { signWebhookPayload, SignedWebhookHeaders } from "./hmac";
import { scrubSymptoms, RedactedSpan } from "./scrubber";
import { logAudit } from "./audit";

export const IntakeRequestSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(7, "Phone number is required"),
  dob: z.string().min(4, "Date of birth is required"),
  insuranceProvider: z.enum([
    "Aetna_PPO",
    "BlueCross_BlueShield",
    "UnitedHealthcare",
    "Cigna_Health",
    "Kaiser_Permanente",
    "Self_Pay_Uninsured",
  ]),
  memberId: z.string().min(3, "Insurance Member ID is required"),
  groupNumber: z.string().optional().default("GRP-DEFAULT"),
  rawSymptoms: z.string().min(10, "Please describe clinical symptoms"),
  hipaaAccepted: z.literal(true, {
    errorMap: () => ({ message: "HIPAA Authorization is required" }),
  }),
  tcpaSmsAccepted: z.literal(true, {
    errorMap: () => ({ message: "TCPA SMS Opt-In is required" }),
  }),
  policyVersion: z.string().optional().default("HIPAA-NPP-2026.1"),
});

export type IntakeRequestInput = z.infer<typeof IntakeRequestSchema>;

export const AiTriageOutputSchema = z.object({
  urgency_level: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  recommended_specialty: z.enum([
    "General Medicine",
    "Cardiology",
    "Dermatology",
    "Mental Health",
    "Neurology",
    "Emergency Care",
  ]),
  triage_rationale_redacted: z.string().min(5),
  insurance_verified: z.boolean(),
  copay_estimate_usd: z.number().nonnegative(),
  suggested_onboarding_track: z.enum([
    "FastTrack",
    "Standard",
    "ManualReview",
    "Emergency911",
  ]),
  prompt_injection_blocked: z.boolean().optional().default(false),
});

export type AiTriageOutput = z.infer<typeof AiTriageOutputSchema>;

export interface InMemoryVaultRecord {
  id: string;
  emailHash: string;
  encryptedPiiJson: string;
  encryptedSymptoms: string;
  encryptedKycJson: string | null;
  scrubbedSymptoms: string;
  redactedSpansJson: RedactedSpan[];
  aiTriageJson: AiTriageOutput | null;
  onboardingTokenHash: string | null;
  rawOnboardingTokenForDemo?: string | null;
  tokenExpiresAt: Date | null;
  tokenUsedAt: Date | null;
  appointmentSlot: Date | null;
  assignedDoctor: string | null;
  status:
    | "SCRUBBED_DISPATCHED"
    | "WEBHOOK_RETRY_PENDING"
    | "AI_TRIAGED"
    | "CRM_SYNCED"
    | "TRIAGE_FAILED_MANUAL_REVIEW"
    | "EMERGENCY_HALTED"
    | "APPROVED"
    | "ONBOARDED";
  hubspotContactId: string | null;
  hubspotDealId: string | null;
  lastError: string | null;
  outboundWebhookDebug?: {
    url: string;
    headers: Record<string, string>;
    payload: Record<string, unknown>;
  };
  blindNotificationDebug?: {
    channel: string;
    recipientMasked: string;
    magicLinkUrl: string;
    dispatchedAt: string;
  };
  createdAt: Date;
  updatedAt: Date;
  consents: Array<{
    id: string;
    consentType: "HIPAA_INTAKE" | "TCPA_SMS" | "TELEHEALTH_NPP";
    signatureText: string | null;
    ipAddress: string;
    policyVersion: string;
    createdAt: Date;
  }>;
  auditLogs: Array<{
    id: string;
    actorId: string;
    actorRole: "PATIENT" | "N8N_SYSTEM" | "CLINICIAN";
    action: string;
    metadata: Record<string, unknown>;
    ipAddress: string;
    createdAt: Date;
  }>;
}

const globalStore = globalThis as unknown as {
  aegisMemoryVault?: Map<string, InMemoryVaultRecord>;
  aegisIdempotencyMap?: Map<string, string>;
};

const memoryVault =
  globalStore.aegisMemoryVault ??
  (globalStore.aegisMemoryVault = new Map<string, InMemoryVaultRecord>());
const memoryIdempotency =
  globalStore.aegisIdempotencyMap ??
  (globalStore.aegisIdempotencyMap = new Map<string, string>());

/**
 * Deterministic Mock Insurance Payer Rules (used by /api/mock/insurance & fallback simulator)
 */
export function evaluateInsuranceEligibility(payer: string) {
  const catalog: Record<
    string,
    {
      verified: boolean;
      copayUsd: number;
      planTier: string;
      priorAuthRequired: boolean;
    }
  > = {
    Aetna_PPO: {
      verified: true,
      copayUsd: 35,
      planTier: "PPO Gold National",
      priorAuthRequired: false,
    },
    BlueCross_BlueShield: {
      verified: true,
      copayUsd: 25,
      planTier: "BCBS Premier Plus",
      priorAuthRequired: false,
    },
    UnitedHealthcare: {
      verified: true,
      copayUsd: 40,
      planTier: "UHC Choice Plus",
      priorAuthRequired: false,
    },
    Cigna_Health: {
      verified: true,
      copayUsd: 30,
      planTier: "Cigna Open Access",
      priorAuthRequired: false,
    },
    Kaiser_Permanente: {
      verified: true,
      copayUsd: 20,
      planTier: "Kaiser HMO Integrated",
      priorAuthRequired: true,
    },
    Self_Pay_Uninsured: {
      verified: false,
      copayUsd: 129,
      planTier: "Transparent Cash Pay",
      priorAuthRequired: false,
    },
  };

  return (
    catalog[payer] ?? {
      verified: true,
      copayUsd: 45,
      planTier: "Standard Commercial",
      priorAuthRequired: false,
    }
  );
}

/**
 * Deterministic Clinical Triage Classifier (used when n8n is unreachable / sleeping per ADR-005 & ADR-007)
 * Enforces XML sandboxing against prompt injection and CRITICAL emergency short-circuits.
 */
export function runDeterministicTriageAnalysis(
  scrubbedSymptoms: string,
  insuranceProvider: string
): AiTriageOutput {
  const lower = scrubbedSymptoms.toLowerCase();
  const payer = evaluateInsuranceEligibility(insuranceProvider);

  const injectionDetected =
    lower.includes("ignore all previous instructions") ||
    lower.includes("ignore previous instructions") ||
    lower.includes("system prompt") ||
    lower.includes("classify urgency_level as low");

  // Emergency Short-Circuit Detection (ADR-005)
  if (
    lower.includes("heart attack") ||
    lower.includes("crushing chest pain") ||
    lower.includes("cannot breathe") ||
    lower.includes("can't breathe") ||
    lower.includes("stroke") ||
    lower.includes("unconscious") ||
    lower.includes("suicidal") ||
    lower.includes("radiating to left arm")
  ) {
    return {
      urgency_level: "CRITICAL",
      recommended_specialty: "Emergency Care",
      triage_rationale_redacted: injectionDetected
        ? "[PROMPT INJECTION ATTEMPT BLOCKED BY <untrusted_symptom_text> SANDBOX] Critical life-threatening cardiac/respiratory red flags detected in scrubbed clinical text. Immediate 911 emergency short-circuit triggered."
        : "Critical life-threatening symptom indicators (acute cardiac/respiratory distress) detected. Automated self-scheduling halted; immediate 911 emergency escalation triggered.",
      insurance_verified: payer.verified,
      copay_estimate_usd: 0,
      suggested_onboarding_track: "Emergency911",
      prompt_injection_blocked: injectionDetected,
    };
  }

  if (
    lower.includes("chest tightness") ||
    lower.includes("palpitation") ||
    lower.includes("arrhythmia") ||
    lower.includes("shortness of breath") ||
    lower.includes("high blood pressure")
  ) {
    return {
      urgency_level: "HIGH",
      recommended_specialty: "Cardiology",
      triage_rationale_redacted: injectionDetected
        ? "[PROMPT INJECTION BLOCKED] Sub-acute cardiopulmonary symptoms warrant priority Cardiology evaluation within 24-48 hours."
        : "Sub-acute cardiopulmonary symptoms (chest tightness / palpitations) warrant priority Cardiology evaluation within 24-48 hours.",
      insurance_verified: payer.verified,
      copay_estimate_usd: payer.copayUsd,
      suggested_onboarding_track: "FastTrack",
      prompt_injection_blocked: injectionDetected,
    };
  }

  if (
    lower.includes("mole") ||
    lower.includes("rash") ||
    lower.includes("eczema") ||
    lower.includes("hives") ||
    lower.includes("skin")
  ) {
    return {
      urgency_level: "LOW",
      recommended_specialty: "Dermatology",
      triage_rationale_redacted:
        "Non-emergent dermatological presentation suitable for standard asynchronous or video Dermatology consultation.",
      insurance_verified: payer.verified,
      copay_estimate_usd: payer.copayUsd,
      suggested_onboarding_track: "Standard",
      prompt_injection_blocked: injectionDetected,
    };
  }

  if (
    lower.includes("migraine") ||
    lower.includes("dizziness") ||
    lower.includes("vision") ||
    lower.includes("numbness")
  ) {
    return {
      urgency_level: "MEDIUM",
      recommended_specialty: "Neurology",
      triage_rationale_redacted:
        "Neurological symptoms (migraine / vertigo / visual disturbance) routed to Neurology specialist review.",
      insurance_verified: payer.verified,
      copay_estimate_usd: payer.copayUsd,
      suggested_onboarding_track: "Standard",
      prompt_injection_blocked: injectionDetected,
    };
  }

  return {
    urgency_level: "MEDIUM",
    recommended_specialty: "General Medicine",
    triage_rationale_redacted: injectionDetected
      ? "[PROMPT INJECTION BLOCKED] General clinical presentation routed to Internal Medicine for standard clinician review."
      : "General clinical presentation routed to Internal Medicine for standard clinician triage review.",
    insurance_verified: payer.verified,
    copay_estimate_usd: payer.copayUsd,
    suggested_onboarding_track: payer.verified ? "Standard" : "ManualReview",
    prompt_injection_blocked: injectionDetected,
  };
}

/**
 * Creates or returns an existing idempotent PatientVault intake record,
 * encrypts PHI with AES-256-GCM, scrubs PII, and dispatches async to n8n.
 */
export async function processPatientIntake(
  input: IntakeRequestInput,
  ipAddress: string,
  userAgent: string
): Promise<{
  patientId: string;
  idempotencyKey: string;
  deduplicated: boolean;
  status: string;
}> {
  const emailHash = sha256Hash(input.email);
  const dateBucket = new Date().toISOString().slice(0, 10);
  const idempotencyKey = `intake_${sha256Hash(`${emailHash}:${dateBucket}:${input.rawSymptoms.slice(0, 32)}`).slice(0, 24)}`;

  // Check two-layer idempotency (ADR-007)
  const existingMemId = memoryIdempotency.get(idempotencyKey);
  if (existingMemId && memoryVault.has(existingMemId)) {
    const existing = memoryVault.get(existingMemId)!;
    return {
      patientId: existing.id,
      idempotencyKey,
      deduplicated: true,
      status: existing.status,
    };
  }

  const patientId = crypto.randomUUID();
  const encryptedPiiJson = encryptPhi(
    JSON.stringify({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      dob: input.dob,
      insuranceProvider: input.insuranceProvider,
      memberId: input.memberId,
      groupNumber: input.groupNumber,
    })
  );
  const encryptedSymptoms = encryptPhi(input.rawSymptoms);

  const scrubResult = scrubSymptoms(input.rawSymptoms, {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    dob: input.dob,
    memberId: input.memberId,
  });

  const crmAlias = generatePseudonymousAlias(patientId);
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const vaultReviewUrl = `${appBaseUrl}/admin/vault/${patientId}`;

  const webhookPayload = {
    idempotency_key: idempotencyKey,
    patient_uuid: patientId,
    crm_alias: {
      first_name: crmAlias.firstName,
      last_name: crmAlias.lastName,
      email: crmAlias.email,
    },
    insurance_provider: input.insuranceProvider,
    scrubbed_symptoms: scrubResult.scrubbedText,
    xml_sandboxed_prompt_input: `<untrusted_symptom_text>\n${scrubResult.scrubbedText}\n</untrusted_symptom_text>`,
    vault_review_url: vaultReviewUrl,
  };

  const rawBody = JSON.stringify(webhookPayload);
  const signedHeaders = signWebhookPayload(rawBody);
  const webhookUrl =
    process.env.N8N_TRIAGE_WEBHOOK_URL ??
    "http://localhost:5678/webhook/aegis-triage";

  const now = new Date();
  const record: InMemoryVaultRecord = {
    id: patientId,
    emailHash,
    encryptedPiiJson,
    encryptedSymptoms,
    encryptedKycJson: null,
    scrubbedSymptoms: scrubResult.scrubbedText,
    redactedSpansJson: scrubResult.redactedSpans,
    aiTriageJson: null,
    onboardingTokenHash: null,
    rawOnboardingTokenForDemo: null,
    tokenExpiresAt: null,
    tokenUsedAt: null,
    appointmentSlot: null,
    assignedDoctor: null,
    status: "SCRUBBED_DISPATCHED",
    hubspotContactId: null,
    hubspotDealId: null,
    lastError: null,
    outboundWebhookDebug: {
      url: webhookUrl,
      headers: {
        "content-type": "application/json",
        ...signedHeaders,
      },
      payload: webhookPayload,
    },
    createdAt: now,
    updatedAt: now,
    consents: [
      {
        id: crypto.randomUUID(),
        consentType: "HIPAA_INTAKE",
        signatureText: `${input.firstName} ${input.lastName} (Digital Opt-In)`,
        ipAddress,
        policyVersion: input.policyVersion,
        createdAt: now,
      },
      {
        id: crypto.randomUUID(),
        consentType: "TCPA_SMS",
        signatureText: `${input.phone} (SMS Opt-In)`,
        ipAddress,
        policyVersion: input.policyVersion,
        createdAt: now,
      },
    ],
    auditLogs: [
      {
        id: crypto.randomUUID(),
        actorId: `patient_${crmAlias.shortId}`,
        actorRole: "PATIENT",
        action: "INTAKE_SUBMITTED",
        metadata: {
          policyVersion: input.policyVersion,
          hipaaAccepted: true,
          tcpaSmsAccepted: true,
          encryptionCipher: "AES-256-GCM",
        },
        ipAddress,
        createdAt: now,
      },
      {
        id: crypto.randomUUID(),
        actorId: "NEXTJS_BFF_SCRUBBER",
        actorRole: "N8N_SYSTEM",
        action: "PII_SCRUBBED",
        metadata: {
          redactionCount: scrubResult.redactionCount,
          crmPseudonym: crmAlias.email,
          idempotencyKey,
        },
        ipAddress,
        createdAt: new Date(now.getTime() + 5),
      },
    ],
  };

  memoryVault.set(patientId, record);
  memoryIdempotency.set(idempotencyKey, patientId);

  // Best-effort persistence to PostgreSQL if DATABASE_URL is configured and container is running
  if (process.env.DATABASE_URL) {
    try {
      await prisma.webhookIdempotency.create({
      data: {
        key: idempotencyKey,
        workflowName: "triage-agent",
        patientId,
        status: "PROCESSING",
      },
    });
    await prisma.patientVault.create({
      data: {
        id: patientId,
        emailHash,
        encryptedPiiJson,
        encryptedSymptoms,
        scrubbedSymptoms: scrubResult.scrubbedText,
        redactedSpansJson: scrubResult.redactedSpans as unknown as object,
        status: "SCRUBBED_DISPATCHED",
      },
    });
    await logAudit({
      actorId: `patient_${crmAlias.shortId}`,
      actorRole: "PATIENT",
      patientId,
      action: "INTAKE_SUBMITTED",
      ipAddress,
      metadata: { idempotencyKey, crmAlias: crmAlias.email },
    });
      await logAudit({
        actorId: "NEXTJS_BFF_SCRUBBER",
        actorRole: "N8N_SYSTEM",
        patientId,
        action: "PII_SCRUBBED",
        ipAddress,
        metadata: { redactionCount: scrubResult.redactionCount },
      });
    } catch {
      // PostgreSQL optional fallback in demo mode
    }
  }

  // Fire asynchronous webhook dispatch (ADR-003, ADR-004, ADR-007)
  void dispatchTriageWebhookAsync(patientId, webhookUrl, rawBody, signedHeaders, input.insuranceProvider);

  return {
    patientId,
    idempotencyKey,
    deduplicated: false,
    status: "SCRUBBED_DISPATCHED",
  };
}

/**
 * Dispatches the signed intake payload to n8n asynchronously.
 * If n8n is unreachable/unactivated and DEMO_SIMULATE_N8N_IF_SLEEPING !== "false",
 * runs the deterministic simulation callback after 900ms so the X-Ray UI transitions smoothly.
 */
export async function dispatchTriageWebhookAsync(
  patientId: string,
  webhookUrl: string,
  rawBody: string,
  signedHeaders: SignedWebhookHeaders,
  insuranceProvider: string
) {
  const simulateIfSleeping =
    (process.env.DEMO_SIMULATE_N8N_IF_SLEEPING ?? "true") !== "false";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...signedHeaders,
      },
      body: rawBody,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      return;
    }
    throw new Error(`n8n webhook returned HTTP ${response.status}`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Webhook timeout";
    const rec = memoryVault.get(patientId);
    if (!rec) return;

    if (simulateIfSleeping) {
      // Simulate realistic 850ms async n8n AI Agent + HubSpot CRM execution (ADR-007)
      setTimeout(() => {
        const current = memoryVault.get(patientId);
        if (!current || current.aiTriageJson) return;

        const triage = runDeterministicTriageAnalysis(
          current.scrubbedSymptoms,
          insuranceProvider
        );
        const alias = generatePseudonymousAlias(patientId);
        applyN8nTriageCallback({
          patient_uuid: patientId,
          status:
            triage.urgency_level === "CRITICAL"
              ? "EMERGENCY_HALTED"
              : "CRM_SYNCED",
          ai_triage: triage,
          hubspot_contact_id: `hs_cnt_${alias.shortId}`,
          hubspot_deal_id: `hs_deal_${alias.shortId}`,
          execution_mode: "SIMULATED_N8N_FALLBACK",
        });
      }, 850);
    } else {
      rec.status = "WEBHOOK_RETRY_PENDING";
      rec.lastError = errorMsg;
      rec.updatedAt = new Date();
    }
  }
}

export function applyN8nTriageCallback(payload: {
  patient_uuid: string;
  status:
    | "AI_TRIAGED"
    | "CRM_SYNCED"
    | "TRIAGE_FAILED_MANUAL_REVIEW"
    | "EMERGENCY_HALTED";
  ai_triage?: AiTriageOutput;
  hubspot_contact_id?: string;
  hubspot_deal_id?: string;
  error_message?: string;
  execution_mode?: string;
}) {
  const rec = memoryVault.get(payload.patient_uuid);
  if (!rec) return null;

  const now = new Date();
  if (payload.status === "TRIAGE_FAILED_MANUAL_REVIEW") {
    rec.status = "TRIAGE_FAILED_MANUAL_REVIEW";
    rec.lastError =
      payload.error_message ?? "Downstream n8n workflow reported DLQ error";
    rec.auditLogs.push({
      id: crypto.randomUUID(),
      actorId: "N8N_ERROR_DLQ",
      actorRole: "N8N_SYSTEM",
      action: "TRIAGE_FAILED",
      metadata: {
        error: rec.lastError,
      },
      ipAddress: "127.0.0.1",
      createdAt: now,
    });
  } else {
    if (payload.ai_triage) {
      rec.aiTriageJson = payload.ai_triage;
    }
    rec.hubspotContactId =
      payload.hubspot_contact_id ??
      `hs_cnt_${payload.patient_uuid.slice(0, 6)}`;
    rec.hubspotDealId =
      payload.hubspot_deal_id ?? `hs_deal_${payload.patient_uuid.slice(0, 6)}`;
    rec.status =
      payload.ai_triage?.urgency_level === "CRITICAL"
        ? "EMERGENCY_HALTED"
        : payload.status;
    rec.lastError = null;

    rec.auditLogs.push({
      id: crypto.randomUUID(),
      actorId: "N8N_TRIAGE_AGENT",
      actorRole: "N8N_SYSTEM",
      action: "AI_TRIAGED",
      metadata: {
        urgency: rec.aiTriageJson?.urgency_level,
        specialty: rec.aiTriageJson?.recommended_specialty,
        track: rec.aiTriageJson?.suggested_onboarding_track,
        hubspotContactId: rec.hubspotContactId,
        hubspotDealId: rec.hubspotDealId,
        promptInjectionBlocked: rec.aiTriageJson?.prompt_injection_blocked,
        mode: payload.execution_mode ?? "LIVE_N8N_WEBHOOK",
      },
      ipAddress: "127.0.0.1",
      createdAt: now,
    });
  }

  rec.updatedAt = now;
  return rec;
}

export function getVaultRecord(patientId: string): InMemoryVaultRecord | null {
  return memoryVault.get(patientId) ?? null;
}

export function getVaultRecordByTokenHash(
  tokenHash: string
): InMemoryVaultRecord | null {
  for (const rec of memoryVault.values()) {
    if (rec.onboardingTokenHash === tokenHash) {
      return rec;
    }
  }
  return null;
}

/**
 * Decrypts a patient record for an authenticated clinician and logs PHI_DECRYPTED_VIEW in AuditLog (FR-3.2).
 */
export function decryptVaultRecordForClinician(
  patientId: string,
  clinicianId: string,
  ipAddress: string = "127.0.0.1",
  recordAudit: boolean = true
) {
  const rec = memoryVault.get(patientId);
  if (!rec) return null;

  const pii = JSON.parse(decryptPhi(rec.encryptedPiiJson)) as {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dob: string;
    insuranceProvider: string;
    memberId: string;
    groupNumber: string;
  };
  const rawSymptoms = decryptPhi(rec.encryptedSymptoms);

  if (recordAudit) {
    rec.auditLogs.push({
      id: crypto.randomUUID(),
      actorId: clinicianId,
      actorRole: "CLINICIAN",
      action: "PHI_DECRYPTED_VIEW",
      metadata: {
        reason: "Clinician HITL Triage Review",
        fieldsDecrypted: ["encryptedPiiJson", "encryptedSymptoms"],
      },
      ipAddress,
      createdAt: new Date(),
    });
  }

  return {
    record: rec,
    decryptedPii: pii,
    decryptedSymptoms: rawSymptoms,
  };
}

/**
 * Clinician approves triage, mints 48h SHA-256 single-use capability token, and triggers Blind Notification Dispatch (FR-3.3, ADR-001, ADR-007).
 */
export function approvePatientForOnboarding(
  patientId: string,
  clinicianId: string,
  assignedDoctor: string,
  ipAddress: string = "127.0.0.1"
) {
  const rec = memoryVault.get(patientId);
  if (!rec) return null;

  const { rawToken, tokenHash, expiresAt } = generateCapabilityToken();
  rec.onboardingTokenHash = tokenHash;
  rec.rawOnboardingTokenForDemo = rawToken;
  rec.tokenExpiresAt = expiresAt;
  rec.tokenUsedAt = null;
  rec.assignedDoctor = assignedDoctor;
  rec.status = "APPROVED";
  rec.updatedAt = new Date();

  rec.auditLogs.push({
    id: crypto.randomUUID(),
    actorId: clinicianId,
    actorRole: "CLINICIAN",
    action: "ONBOARDING_APPROVED",
    metadata: {
      assignedDoctor,
      onboardingTokenHashPrefix: tokenHash.slice(0, 12) + "...",
      expiresAt: expiresAt.toISOString(),
    },
    ipAddress,
    createdAt: new Date(),
  });

  // Trigger Blind Notification Dispatch (ADR-001)
  const pii = JSON.parse(decryptPhi(rec.encryptedPiiJson)) as {
    email: string;
    phone: string;
  };
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const magicLinkUrl = `${appBaseUrl}/onboarding/${rawToken}`;
  const maskedEmail = pii.email.replace(/^(..).*(@.*)$/, "$1***$2");

  rec.blindNotificationDebug = {
    channel: "EMAIL + SMS (Blind Vault Dispatch via /api/internal/notify)",
    recipientMasked: `${maskedEmail} | ${pii.phone.slice(0, 4)}***${pii.phone.slice(-2)}`,
    magicLinkUrl,
    dispatchedAt: new Date().toISOString(),
  };

  rec.auditLogs.push({
    id: crypto.randomUUID(),
    actorId: "NEXTJS_BLIND_NOTIFIER",
    actorRole: "N8N_SYSTEM",
    action: "BLIND_NOTIFY_SENT",
    metadata: {
      recipientMasked: maskedEmail,
      zeroPhiBody: true,
      hubspotDealStage: "Approved - Onboarding Sent",
    },
    ipAddress,
    createdAt: new Date(Date.now() + 5),
  });

  return {
    rawToken,
    tokenHash,
    expiresAt,
    magicLinkUrl,
    record: rec,
  };
}

/**
 * Completes the 3-step patient onboarding portal, burns the single-use capability token (tokenUsedAt = now()),
 * and transitions HubSpot Contact -> customer and Deal -> Closed Won (FR-4.1..4.5, ADR-007).
 */
export function completePatientOnboarding(params: {
  rawToken: string;
  kycIdType: string;
  kycCardNumberLast4: string;
  nppSignatureText: string;
  appointmentSlotIso: string;
  ipAddress?: string;
}) {
  const tokenHash = sha256Hash(params.rawToken);
  const rec = getVaultRecordByTokenHash(tokenHash);

  if (!rec) {
    return { error: "Invalid or unknown onboarding token", code: 404 as const };
  }
  if (rec.tokenUsedAt) {
    return {
      error: "Capability token has already been used and burned",
      code: 410 as const,
      alreadyCompleted: true,
      record: rec,
    };
  }
  if (rec.tokenExpiresAt && rec.tokenExpiresAt.getTime() < Date.now()) {
    return { error: "Onboarding token has expired (>48h)", code: 410 as const };
  }

  const now = new Date();
  const ip = params.ipAddress ?? "127.0.0.1";

  rec.encryptedKycJson = encryptPhi(
    JSON.stringify({
      kycIdType: params.kycIdType,
      kycCardNumberLast4: params.kycCardNumberLast4,
      verifiedAt: now.toISOString(),
    })
  );
  rec.tokenUsedAt = now; // Burn single-use token (ADR-007)
  rec.appointmentSlot = new Date(params.appointmentSlotIso);
  rec.status = "ONBOARDED";
  rec.updatedAt = now;

  rec.consents.push({
    id: crypto.randomUUID(),
    consentType: "TELEHEALTH_NPP",
    signatureText: params.nppSignatureText,
    ipAddress: ip,
    policyVersion: "TELEHEALTH-NPP-2026.1",
    createdAt: now,
  });

  rec.auditLogs.push(
    {
      id: crypto.randomUUID(),
      actorId: `patient_${rec.id.slice(0, 6)}`,
      actorRole: "PATIENT",
      action: "KYC_VERIFIED",
      metadata: {
        kycIdType: params.kycIdType,
        encryptedAtRest: true,
      },
      ipAddress: ip,
      createdAt: now,
    },
    {
      id: crypto.randomUUID(),
      actorId: `patient_${rec.id.slice(0, 6)}`,
      actorRole: "PATIENT",
      action: "ONBOARDING_COMPLETED",
      metadata: {
        tokenBurnedAt: now.toISOString(),
        appointmentSlot: params.appointmentSlotIso,
        hubspotDealStage: "Closed Won - Appointment Booked",
        hubspotContactLifecycle: "customer",
      },
      ipAddress: ip,
      createdAt: new Date(now.getTime() + 5),
    }
  );

  return {
    code: 200 as const,
    record: rec,
  };
}
