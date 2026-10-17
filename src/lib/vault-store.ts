import crypto from "crypto";
import { Prisma, type AuditAction, type ActorRole } from "@prisma/client";
import { prisma } from "./prisma";
import {
  encryptPhi,
  decryptPhi,
  sha256Hash,
  generateCapabilityToken,
  generatePseudonymousAlias,
} from "./crypto";
import { scrubSymptoms } from "./scrubber";
import { appUrl, isDemoMode } from "./config";
import {
  AiTriageOutputSchema,
  runDeterministicTriageAnalysis,
  type AiTriageOutput,
  type IntakeRequestInput,
} from "./triage";
export {
  IntakeRequestSchema,
  AiTriageOutputSchema,
  evaluateInsuranceEligibility,
  runDeterministicTriageAnalysis,
} from "./triage";
export type { AiTriageOutput, IntakeRequestInput } from "./triage";

const include = {
  consents: true,
  auditLogs: { orderBy: { createdAt: "asc" as const } },
  deliveries: true,
};
type Tx = Prisma.TransactionClient;
export class WorkflowError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}
export function audit(
  tx: Tx,
  patientId: string,
  action: AuditAction,
  actorId: string,
  actorRole: ActorRole,
  metadata: Prisma.InputJsonValue = {},
  ipAddress = "127.0.0.1",
) {
  return tx.auditLog.create({
    data: { patientId, action, actorId, actorRole, metadata, ipAddress },
  });
}
export function getVaultRecord(patientId: string) {
  if (!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(patientId)) return Promise.resolve(null);
  return prisma.patientVault.findUnique({ where: { id: patientId }, include });
}
export function getVaultRecordByTokenHash(tokenHash: string) {
  return prisma.patientVault.findUnique({
    where: { onboardingTokenHash: tokenHash },
    include,
  });
}
export async function enqueueDelivery(
  tx: Tx,
  patientId: string,
  stage: string,
  payload: object,
  key = `${stage}:${patientId}`,
) {
  return tx.outboxDelivery.upsert({
    where: { idempotencyKey: key },
    update: {},
    create: {
      patientId,
      stage,
      idempotencyKey: key,
      encryptedPayload: encryptPhi(JSON.stringify(payload)),
    },
  });
}
export async function processPatientIntake(
  input: IntakeRequestInput,
  ipAddress: string,
  userAgent: string,
  options: { inspectorToken?: string } = {},
) {
  const emailHash = sha256Hash(input.email);
  const inspectorToken =
    options.inspectorToken ?? crypto.randomBytes(32).toString("hex");
  const inspectorAccessHash = sha256Hash(inspectorToken);
  const demoScope = isDemoMode() ? inspectorAccessHash : "";
  const idempotencyKey = `intake:${sha256Hash(`${emailHash}:${new Date().toISOString().slice(0, 10)}:${input.rawSymptoms}:${demoScope}`)}`;
  async function duplicate(patientId: string) {
    const record = await getVaultRecord(patientId);
    if (!record || record.inspectorAccessHash !== inspectorAccessHash)
      throw new WorkflowError(
        "An intake already exists. Continue in the browser that submitted it.",
      );
    return {
      patientId,
      idempotencyKey,
      deduplicated: true,
      status: record.status,
      inspectorToken,
    };
  }
  const existing = await prisma.webhookIdempotency.findUnique({
    where: { key: idempotencyKey },
  });
  if (existing?.patientId) return duplicate(existing.patientId);
  const patientId = crypto.randomUUID();
  const {
    rawSymptoms,
    hipaaAccepted: _hipaa,
    tcpaSmsAccepted: _tcpa,
    policyVersion,
    ...pii
  } = input;
  const scrubbed = scrubSymptoms(rawSymptoms, input);
  const redactedSpans = scrubbed.redactedSpans.map(({ replacement, pass }) => ({
    replacement,
    pass,
  }));
  const alias = generatePseudonymousAlias(patientId);
  const payload = {
    patient_uuid: patientId,
    idempotency_key: idempotencyKey,
    crm_alias: { first_name: alias.firstName, email: alias.email },
    insurance_provider: input.insuranceProvider,
    scrubbed_symptoms: scrubbed.scrubbedText,
    vault_review_url: `${appUrl()}/admin/vault/${patientId}`,
  };
  try {
    await prisma.$transaction(async (tx) => {
      await tx.webhookIdempotency.create({
        data: { key: idempotencyKey, workflowName: "triage-agent", patientId },
      });
      await tx.patientVault.create({
        data: {
          id: patientId,
          emailHash,
          encryptedPiiJson: encryptPhi(JSON.stringify(pii)),
          encryptedSymptoms: encryptPhi(rawSymptoms),
          scrubbedSymptoms: scrubbed.scrubbedText,
          redactedSpansJson: redactedSpans,
          inspectorAccessHash,
          consents: {
            create: ["HIPAA_INTAKE", "TCPA_SMS"].map((consentType) => ({
              consentType: consentType as "HIPAA_INTAKE" | "TCPA_SMS",
              accepted: true,
              signatureText: encryptPhi("Digital opt-in"),
              ipAddress,
              userAgent,
              policyVersion,
            })),
          },
        },
      });
      await audit(
        tx,
        patientId,
        "INTAKE_SUBMITTED",
        `patient_${alias.shortId}`,
        "PATIENT",
        { policyVersion },
        ipAddress,
      );
      await audit(
        tx,
        patientId,
        "PII_SCRUBBED",
        "NEXTJS_BFF_SCRUBBER",
        "N8N_SYSTEM",
        { redactionCount: scrubbed.redactionCount },
        ipAddress,
      );
      await enqueueDelivery(tx, patientId, "TRIAGE", payload, idempotencyKey);
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const raced = await prisma.webhookIdempotency.findUnique({
        where: { key: idempotencyKey },
      });
      if (raced?.patientId) return duplicate(raced.patientId);
    }
    throw error;
  }
  return {
    patientId,
    idempotencyKey,
    deduplicated: false,
    status: "SCRUBBED_DISPATCHED",
    inspectorToken,
  };
}

export async function applyN8nTriageCallback(payload: {
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
  idempotency_key?: string;
}) {
  if (payload.ai_triage)
    payload.ai_triage = AiTriageOutputSchema.parse(payload.ai_triage);
  const key = `callback:${sha256Hash(JSON.stringify(payload))}`;
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "PatientVault" WHERE id = ${payload.patient_uuid}::uuid FOR UPDATE`;
    const record = await tx.patientVault.findUnique({
      where: { id: payload.patient_uuid },
    });
    if (!record) return null;
    if (await tx.webhookIdempotency.findUnique({ where: { key } }))
      return record;
    if (["APPROVED", "ONBOARDED", "EMERGENCY_HALTED"].includes(record.status))
      return record;
    const failure = payload.status === "TRIAGE_FAILED_MANUAL_REVIEW";
    if (!failure && !payload.ai_triage)
      throw new WorkflowError("Triage result is required", 422);
    if (payload.ai_triage) {
      const pii = JSON.parse(decryptPhi(record.encryptedPiiJson));
      payload.ai_triage.triage_rationale_redacted = scrubSymptoms(
        payload.ai_triage.triage_rationale_redacted,
        pii,
      ).scrubbedText;
      if (payload.ai_triage.urgency_level === "CRITICAL") {
        payload.ai_triage.recommended_specialty = "Emergency Care";
        payload.ai_triage.suggested_onboarding_track = "Emergency911";
        payload.ai_triage.copay_estimate_usd = 0;
      }
    }
    const status =
      payload.ai_triage?.urgency_level === "CRITICAL"
        ? "EMERGENCY_HALTED"
        : payload.status;
    const updated = await tx.patientVault.update({
      where: { id: record.id },
      data: {
        status,
        aiTriageJson: payload.ai_triage as Prisma.InputJsonValue | undefined,
        hubspotContactId: payload.hubspot_contact_id,
        hubspotDealId: payload.hubspot_deal_id,
        executionMode: payload.execution_mode ?? "LIVE_GEMINI_N8N",
        lastError: failure ? "DOWNSTREAM_WORKFLOW_FAILED" : null,
        crmSyncStage: payload.hubspot_deal_id ? "TRIAGED" : undefined,
      },
    });
    await tx.webhookIdempotency.create({
      data: {
        key,
        workflowName: "triage-callback",
        patientId: record.id,
        status: "COMPLETED",
      },
    });
    await audit(
      tx,
      record.id,
      failure ? "TRIAGE_FAILED" : "AI_TRIAGED",
      failure ? "N8N_ERROR_DLQ" : "GEMINI_TRIAGE_AGENT",
      "N8N_SYSTEM",
      {
        urgency: payload.ai_triage?.urgency_level ?? "UNKNOWN",
        mode: updated.executionMode,
      },
    );
    await tx.webhookIdempotency.updateMany({
      where: { patientId: record.id, workflowName: "triage-agent" },
      data: { status: failure ? "FAILED" : "COMPLETED" },
    });
    return updated;
  });
}

export async function decryptVaultRecordForClinician(
  patientId: string,
  clinicianId: string,
  ipAddress = "127.0.0.1",
  recordAudit = true,
) {
  const record = await getVaultRecord(patientId);
  if (!record) return null;
  if (recordAudit)
    await prisma.$transaction((tx) =>
      audit(
        tx,
        patientId,
        "PHI_DECRYPTED_VIEW",
        clinicianId,
        "CLINICIAN",
        { reason: "Clinician review" },
        ipAddress,
      ),
    );
  return {
    record,
    decryptedPii: JSON.parse(decryptPhi(record.encryptedPiiJson)),
    decryptedSymptoms: decryptPhi(record.encryptedSymptoms),
  };
}
export async function approvePatientForOnboarding(
  patientId: string,
  clinicianId: string,
  assignedDoctor: string,
  ipAddress = "127.0.0.1",
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "PatientVault" WHERE id = ${patientId}::uuid FOR UPDATE`;
    const record = await tx.patientVault.findUnique({
      where: { id: patientId },
    });
    if (!record) return null;
    const triage = record.aiTriageJson
      ? AiTriageOutputSchema.parse(record.aiTriageJson)
      : null;
    if (
      record.status === "EMERGENCY_HALTED" ||
      triage?.urgency_level === "CRITICAL"
    )
      throw new WorkflowError(
        "Emergency cases cannot enter self-scheduling onboarding",
      );
    if (
      record.status === "APPROVED" &&
      record.notificationMode === "GMAIL_SENT" &&
      record.tokenExpiresAt &&
      record.tokenExpiresAt > new Date()
    )
      throw new WorkflowError(
        "The active invitation has already been emailed. Use the delivered link.",
      );
    if (
      record.status === "APPROVED" &&
      record.encryptedOnboardingToken &&
      record.tokenExpiresAt &&
      record.tokenExpiresAt > new Date()
    ) {
      const rawToken = decryptPhi(record.encryptedOnboardingToken);
      return {
        rawToken,
        tokenHash: record.onboardingTokenHash!,
        expiresAt: record.tokenExpiresAt,
        magicLinkUrl: `${appUrl()}/onboarding/${rawToken}`,
        record,
      };
    }
    if (
      ![
        "CRM_SYNCED",
        "AI_TRIAGED",
        "TRIAGE_FAILED_MANUAL_REVIEW",
        "APPROVED",
      ].includes(record.status)
    )
      throw new WorkflowError("This intake is not ready for approval");
    const { rawToken, tokenHash, expiresAt } = generateCapabilityToken();
    const updated = await tx.patientVault.update({
      where: { id: patientId },
      data: {
        onboardingTokenHash: tokenHash,
        encryptedOnboardingToken: encryptPhi(rawToken),
        tokenExpiresAt: expiresAt,
        tokenUsedAt: null,
        notificationMode: null,
        assignedDoctor,
        status: "APPROVED",
      },
    });
    await audit(
      tx,
      patientId,
      "ONBOARDING_APPROVED",
      clinicianId,
      "CLINICIAN",
      {},
      ipAddress,
    );
    await enqueueDelivery(
      tx,
      patientId,
      "ONBOARDING_DISPATCH",
      { patient_uuid: patientId, idempotency_key: `approve:${tokenHash}` },
      `approve:${tokenHash}`,
    );
    return {
      rawToken,
      tokenHash,
      expiresAt,
      magicLinkUrl: `${appUrl()}/onboarding/${rawToken}`,
      record: updated,
    };
  });
}
export async function completePatientOnboarding(params: {
  rawToken: string;
  kycIdType: string;
  kycCardNumberLast4: string;
  nppSignatureText: string;
  appointmentSlotIso: string;
  ipAddress?: string;
}) {
  const tokenHash = sha256Hash(params.rawToken);
  return prisma.$transaction(async (tx) => {
    const records = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT id FROM "PatientVault" WHERE "onboardingTokenHash" = ${tokenHash} FOR UPDATE`;
    const record = records[0]
      ? await tx.patientVault.findUnique({ where: { id: records[0].id } })
      : null;
    if (!record)
      return {
        error: "Invalid or unknown onboarding token",
        code: 404 as const,
      };
    if (record.tokenUsedAt)
      return {
        error: "Capability token already used",
        code: 410 as const,
        alreadyCompleted: true,
        record,
      };
    if (!record.tokenExpiresAt || record.tokenExpiresAt <= new Date())
      return { error: "Onboarding link expired", code: 410 as const };
    const triage = AiTriageOutputSchema.safeParse(record.aiTriageJson);
    if (
      record.status !== "APPROVED" ||
      triage.data?.urgency_level === "CRITICAL"
    )
      return {
        error: "Intake is not eligible for onboarding",
        code: 409 as const,
      };
    const slot = new Date(params.appointmentSlotIso);
    if (!Number.isFinite(slot.getTime()) || slot <= new Date())
      return { error: "Select a valid future appointment", code: 422 as const };
    const updated = await tx.patientVault.update({
      where: { id: record.id },
      data: {
        encryptedKycJson: encryptPhi(
          JSON.stringify({
            kycIdType: params.kycIdType,
            kycCardNumberLast4: params.kycCardNumberLast4,
          }),
        ),
        tokenUsedAt: new Date(),
        encryptedOnboardingToken: null,
        appointmentSlot: slot,
        status: "ONBOARDED",
      },
    });
    await tx.consentRecord.create({
      data: {
        patientId: record.id,
        consentType: "TELEHEALTH_NPP",
        signatureText: encryptPhi(params.nppSignatureText),
        ipAddress: params.ipAddress ?? "127.0.0.1",
        userAgent: "Onboarding Portal",
        policyVersion: "TELEHEALTH-NPP-2026.1",
      },
    });
    await audit(
      tx,
      record.id,
      "KYC_VERIFIED",
      `patient_${record.id}`,
      "PATIENT",
    );
    await audit(
      tx,
      record.id,
      "ONBOARDING_COMPLETED",
      `patient_${record.id}`,
      "PATIENT",
      { tokenBurned: true },
      params.ipAddress,
    );
    await enqueueDelivery(tx, record.id, "ONBOARDING_COMPLETE", {
      patient_uuid: record.id,
      idempotency_key: `complete:${record.id}`,
    });
    return { code: 200 as const, record: updated };
  });
}
export async function retryPatientDispatch(patientId: string) {
  await prisma.$transaction(async (tx) => {
    const record = await tx.patientVault.findUnique({
      where: { id: patientId },
    });
    if (!record) throw new WorkflowError("Record not found", 404);
    if (
      !["WEBHOOK_RETRY_PENDING", "TRIAGE_FAILED_MANUAL_REVIEW"].includes(
        record.status,
      )
    )
      throw new WorkflowError("No failed triage dispatch to retry");
    await tx.outboxDelivery.updateMany({
      where: { patientId, stage: "TRIAGE" },
      data: {
        status: "PENDING",
        leaseUntil: null,
        availableAt: new Date(),
        attempts: 0,
      },
    });
    await tx.patientVault.update({
      where: { id: patientId },
      data: { status: "SCRUBBED_DISPATCHED", lastError: null },
    });
    await audit(
      tx,
      patientId,
      "INTAKE_SUBMITTED",
      "OUTBOX_RETRY",
      "N8N_SYSTEM",
      { retry: true },
    );
  });
}
export async function simulateTriage(
  patientId: string,
  insuranceProvider: string,
) {
  if (!isDemoMode() || process.env.DEMO_SIMULATE_N8N_IF_SLEEPING !== "true")
    throw new Error("Simulation is disabled");
  const record = await getVaultRecord(patientId);
  if (!record) return;
  const triage = runDeterministicTriageAnalysis(
    record.scrubbedSymptoms,
    insuranceProvider,
  );
  await applyN8nTriageCallback({
    patient_uuid: patientId,
    ai_triage: triage,
    status: "AI_TRIAGED",
    execution_mode: "SIMULATED_N8N_FALLBACK",
  });
}
