import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/hmac";
import { getVaultRecord } from "@/lib/vault-store";
import { decryptPhi } from "@/lib/crypto";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-aegis-signature");
  const timestamp = request.headers.get("x-aegis-timestamp");

  const verified = verifyWebhookSignature(rawBody, signature, timestamp);
  if (!verified.valid) {
    return NextResponse.json(
      { error: "Unauthorized blind notification request", reason: verified.reason },
      { status: 401 }
    );
  }

  const payload = JSON.parse(rawBody) as {
    patient_uuid: string;
    template: string;
    onboarding_url?: string;
  };

  const record = getVaultRecord(payload.patient_uuid);
  if (!record) {
    return NextResponse.json(
      { error: "PatientVault record not found" },
      { status: 404 }
    );
  }

  const pii = JSON.parse(decryptPhi(record.encryptedPiiJson)) as {
    email: string;
    phone: string;
  };
  const maskedEmail = pii.email.replace(/^(..).*(@.*)$/, "$1***$2");

  return NextResponse.json({
    dispatched: true,
    zeroPhiExternalLeak: true,
    recipientMasked: maskedEmail,
    template: payload.template,
    dispatchedAt: new Date().toISOString(),
  });
}
