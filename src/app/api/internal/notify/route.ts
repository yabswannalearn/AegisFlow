import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyWebhookSignature } from "@/lib/hmac";
import { dispatchBlindNotification } from "@/lib/integrations";
export async function POST(request: NextRequest) {
  const body = await request.text();
  if (!verifyWebhookSignature(body, request.headers.get("x-aegis-signature"), request.headers.get("x-aegis-timestamp")).valid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  try {
    const input = z.object({ patient_uuid: z.string().uuid() }).parse(JSON.parse(body));
    return NextResponse.json(await dispatchBlindNotification(input.patient_uuid));
  } catch { return NextResponse.json({ error: "Notification could not be delivered" }, { status: 503 }); }
}
