import { NextRequest, NextResponse } from "next/server";
import {
  CLINICIAN_COOKIE_NAME,
  verifyClinicianToken,
} from "@/lib/auth";
import {
  decryptVaultRecordForClinician,
  approvePatientForOnboarding,
} from "@/lib/vault-store";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const token = request.cookies.get(CLINICIAN_COOKIE_NAME)?.value;
  const session = await verifyClinicianToken(token);

  if (!session) {
    return NextResponse.json(
      {
        error: "Clinician RBAC authentication required",
        requireDemoLogin: true,
      },
      { status: 401 }
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "127.0.0.1";
  const decrypted = decryptVaultRecordForClinician(id, session.sub, ip, true);

  if (!decrypted) {
    return NextResponse.json(
      { error: "PatientVault record not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    clinician: session,
    patientId: decrypted.record.id,
    status: decrypted.record.status,
    decryptedPii: decrypted.decryptedPii,
    decryptedSymptoms: decrypted.decryptedSymptoms,
    scrubbedSymptoms: decrypted.record.scrubbedSymptoms,
    aiTriage: decrypted.record.aiTriageJson,
    hubspotContactId: decrypted.record.hubspotContactId,
    hubspotDealId: decrypted.record.hubspotDealId,
    assignedDoctor: decrypted.record.assignedDoctor,
    magicLinkUrl:
      decrypted.record.blindNotificationDebug?.magicLinkUrl ?? null,
    rawOnboardingToken:
      decrypted.record.rawOnboardingTokenForDemo ?? null,
    auditLogs: decrypted.record.auditLogs,
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const token = request.cookies.get(CLINICIAN_COOKIE_NAME)?.value;
  const session = await verifyClinicianToken(token);

  if (!session) {
    return NextResponse.json(
      { error: "Clinician RBAC authentication required" },
      { status: 401 }
    );
  }

  let body: { assignedDoctor?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Use default clinician
  }

  const assignedDoctor = body.assignedDoctor ?? session.name;
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "127.0.0.1";

  const approval = approvePatientForOnboarding(
    id,
    session.sub,
    assignedDoctor,
    ip
  );

  if (!approval) {
    return NextResponse.json(
      { error: "PatientVault record not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    message:
      "Patient approved. 48h SHA-256 capability token generated and Blind Notification dispatched.",
    patientId: id,
    status: approval.record.status,
    assignedDoctor,
    onboardingTokenHash: approval.tokenHash,
    tokenExpiresAt: approval.expiresAt,
    magicLinkUrl: approval.magicLinkUrl,
    onboardingPath: `/onboarding/${approval.rawToken}`,
  });
}
