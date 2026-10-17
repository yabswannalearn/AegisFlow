import { NextRequest, NextResponse, after } from "next/server";
import { getVaultRecord, retryPatientDispatch, WorkflowError } from "@/lib/vault-store";
import { canInspect } from "@/lib/access";
import { dispatchPendingOutbox } from "@/lib/outbox";
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const record = await getVaultRecord(id);
  if (!record || !await canInspect(request, record)) return NextResponse.json({ error: "Inspector session required" }, { status: 401 });
  try {
    await retryPatientDispatch(id);
    after(() => dispatchPendingOutbox());
    return NextResponse.json({ patientId: id, status: "SCRUBBED_DISPATCHED" }, { status: 202 });
  } catch (error) { return NextResponse.json({ error: error instanceof WorkflowError ? error.message : "Retry failed" }, { status: error instanceof WorkflowError ? error.status : 503 }); }
}
