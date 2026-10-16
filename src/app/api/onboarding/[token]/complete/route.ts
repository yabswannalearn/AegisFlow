import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sha256Hash } from "@/lib/crypto";
import {
  getVaultRecordByTokenHash,
  completePatientOnboarding,
} from "@/lib/vault-store";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const tokenHash = sha256Hash(token);
  const record = getVaultRecordByTokenHash(tokenHash);

  if (!record) {
    return NextResponse.json(
      { valid: false, error: "Invalid or unknown capability token" },
      { status: 404 }
    );
  }

  const burned = record.tokenUsedAt !== null;
  const expired =
    record.tokenExpiresAt !== null &&
    record.tokenExpiresAt.getTime() < Date.now();

  return NextResponse.json({
    valid: !burned && !expired,
    burned,
    expired,
    patientId: record.id,
    status: record.status,
    tokenHashPrefix: tokenHash.slice(0, 16) + "...",
    tokenUsedAt: record.tokenUsedAt,
    tokenExpiresAt: record.tokenExpiresAt,
    assignedDoctor:
      record.assignedDoctor ?? "Dr. Sarah Chen, MD (Cardiology)",
    recommendedSpecialty:
      record.aiTriageJson?.recommended_specialty ?? "Cardiology",
    copayEstimateUsd: record.aiTriageJson?.copay_estimate_usd ?? 35,
    appointmentSlot: record.appointmentSlot,
    hubspotDealId: record.hubspotDealId,
    hubspotContactId: record.hubspotContactId,
  });
}

const CompleteOnboardingSchema = z.object({
  kycIdType: z.string().min(2),
  kycCardNumberLast4: z.string().min(4).max(4),
  nppSignatureText: z.string().min(3, "Legal e-signature is required"),
  appointmentSlotIso: z.string().min(5, "Appointment time slot is required"),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const body = await request.json();
  const parsed = CompleteOnboardingSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Onboarding validation failed",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "127.0.0.1";

  const result = completePatientOnboarding({
    rawToken: token,
    ...parsed.data,
    ipAddress: ip,
  });

  if ("error" in result) {
    return NextResponse.json(
      {
        error: result.error,
        alreadyCompleted: result.alreadyCompleted ?? false,
      },
      { status: result.code }
    );
  }

  return NextResponse.json({
    message:
      "Patient onboarding complete. Single-use capability token burned; HubSpot Contact upgraded to customer and Deal moved to Closed Won.",
    patientId: result.record.id,
    status: result.record.status,
    tokenBurnedAt: result.record.tokenUsedAt,
    appointmentSlot: result.record.appointmentSlot,
    hubspotDealStage: "Closed Won - Appointment Booked",
    hubspotContactLifecycle: "customer",
  });
}
