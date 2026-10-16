import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyWebhookSignature } from "@/lib/hmac";
import {
  AiTriageOutputSchema,
  applyN8nTriageCallback,
} from "@/lib/vault-store";

const CallbackPayloadSchema = z.object({
  patient_uuid: z.string().min(1),
  status: z
    .enum([
      "AI_TRIAGED",
      "CRM_SYNCED",
      "TRIAGE_FAILED_MANUAL_REVIEW",
      "EMERGENCY_HALTED",
    ])
    .optional()
    .default("CRM_SYNCED"),
  ai_triage: AiTriageOutputSchema.optional(),
  hubspot_contact_id: z.string().optional(),
  hubspot_deal_id: z.string().optional(),
  error_message: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-aegis-signature");
  const timestamp = request.headers.get("x-aegis-timestamp");

  const verified = verifyWebhookSignature(rawBody, signature, timestamp);
  if (!verified.valid) {
    return NextResponse.json(
      { error: "Invalid HMAC signature", reason: verified.reason },
      { status: 401 }
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CallbackPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Callback payload failed Zod schema validation (ADR-005)",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 }
    );
  }

  const updated = applyN8nTriageCallback({
    ...parsed.data,
    execution_mode: "LIVE_N8N_WEBHOOK",
  });

  if (!updated) {
    return NextResponse.json(
      { error: "PatientVault record not found for patient_uuid" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    patientId: updated.id,
    status: updated.status,
  });
}
