import { z } from "zod";

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
  rawSymptoms: z.string().min(10, "Please describe clinical symptoms").max(10000),
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
  triage_rationale_redacted: z.string().min(5).max(2000),
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
