import { NextRequest, NextResponse } from "next/server";
import { safeEqual, requiredSecret } from "@/lib/config";
import { dispatchPendingOutbox } from "@/lib/outbox";
export async function POST(request: NextRequest) {
  if (!safeEqual(request.headers.get("authorization"), `Bearer ${requiredSecret("AEGIS_WORKER_SECRET")}`)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ processed: await dispatchPendingOutbox() });
}
