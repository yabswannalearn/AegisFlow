import { NextRequest, NextResponse } from "next/server";
import {
  getVaultRecord,
  dispatchTriageWebhookAsync,
} from "@/lib/vault-store";
import { signWebhookPayload } from "@/lib/hmac";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const record = getVaultRecord(id);

  if (!record) {
    return NextResponse.json(
      { error: "PatientVault record not found" },
      { status: 404 }
    );
  }

  record.status = "SCRUBBED_DISPATCHED";
  record.lastError = null;
  record.updatedAt = new Date();

  const payload = record.outboundWebhookDebug?.payload ?? {
    patient_uuid: record.id,
    scrubbed_symptoms: record.scrubbedSymptoms,
  };
  const rawBody = JSON.stringify(payload);
  const signedHeaders = signWebhookPayload(rawBody);
  const webhookUrl =
    process.env.N8N_TRIAGE_WEBHOOK_URL ??
    "http://localhost:5678/webhook/aegis-triage";

  void dispatchTriageWebhookAsync(
    record.id,
    webhookUrl,
    rawBody,
    signedHeaders,
    String(payload.insurance_provider ?? "Aetna_PPO")
  );

  return NextResponse.json({
    message: "Outbox webhook re-dispatched",
    patientId: record.id,
    status: record.status,
  });
}
