import { NextRequest, NextResponse, after } from "next/server";
import { WorkflowError } from "@/lib/vault-store";
import { dispatchPendingOutbox } from "@/lib/outbox";
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
  const decrypted = await decryptVaultRecordForClinician(id, session.sub, ip, true);

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
      null,
    rawOnboardingToken:
      null,
    auditLogs: decrypted.record.auditLogs,
  });
}

async function approve(
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

  const approval = await approvePatientForOnboarding(
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
      "Patient approved. Onboarding invitation queued for delivery.",
    patientId: id,
    status: approval.record.status,
    assignedDoctor,
    onboardingTokenHash: approval.tokenHash,
    tokenExpiresAt: approval.expiresAt,
    magicLinkUrl: approval.magicLinkUrl,
    onboardingPath: `/onboarding/${approval.rawToken}`,
  });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try { const response = await approve(request, context); if (response.ok) after(() => dispatchPendingOutbox()); return response; }
  catch (error) { return NextResponse.json({ error: error instanceof WorkflowError ? error.message : "Approval failed" }, { status: error instanceof WorkflowError ? error.status : 503 }); }
}
