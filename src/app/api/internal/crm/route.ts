import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyWebhookSignature } from "@/lib/hmac";
import { syncHubspot } from "@/lib/integrations";
export async function POST(request: NextRequest) {
  const body = await request.text();
  if (!verifyWebhookSignature(body, request.headers.get("x-aegis-signature"), request.headers.get("x-aegis-timestamp")).valid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  try {
    const input = z.object({ patient_uuid: z.string().uuid(), stage: z.enum(["TRIAGED", "APPROVED", "ONBOARDED"]) }).parse(JSON.parse(body));
    const record = await syncHubspot(input.patient_uuid,input.stage);
    return NextResponse.json({ patient_uuid: record.id, hubspot_contact_id: record.hubspotContactId, hubspot_deal_id: record.hubspotDealId, crm_stage: record.crmSyncStage });
  } catch { return NextResponse.json({ error: "CRM synchronization failed" }, { status: 503 }); }
}
