import { NextRequest, NextResponse, after } from "next/server";
import crypto from "crypto";
import { INSPECTOR_COOKIE } from "@/lib/access";
import { dispatchPendingOutbox } from "@/lib/outbox";
import { WorkflowError } from "@/lib/vault-store";
import { IntakeRequestSchema, processPatientIntake } from "@/lib/vault-store";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = IntakeRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "127.0.0.1";
    const userAgent = request.headers.get("user-agent") ?? "AegisFlow-Client";

    const result = await processPatientIntake(
      parsed.data,
      ipAddress,
      userAgent,
      { inspectorToken: request.cookies.get(INSPECTOR_COOKIE)?.value ?? crypto.randomBytes(32).toString("hex") }
    );

    const response = NextResponse.json(
      {
        message: result.deduplicated
          ? "Idempotent submission matched existing PatientVault record"
          : "Patient intake encrypted in Vault and dispatched to n8n asynchronously",
        patientId: result.patientId,
        idempotencyKey: result.idempotencyKey,
        deduplicated: result.deduplicated,
        status: result.status,
        telemetryUrl: `/api/intake/${result.patientId}/telemetry`,
        vaultReviewUrl: `/admin/vault/${result.patientId}`,
      },
      { status: 202 }
    );
    response.cookies.set(INSPECTOR_COOKIE, result.inspectorToken, { httpOnly: true, sameSite: "strict", path: "/", maxAge: 3600, secure: request.nextUrl.protocol === "https:" });
    after(() => dispatchPendingOutbox());
    return response;
  } catch (err) {
    console.error("INTAKE_FAILED", { name: err instanceof Error ? err.name : "Unknown", code: typeof err === "object" && err && "code" in err ? err.code : undefined });
    return NextResponse.json(
      {
        error: "Failed to process patient intake",
        message: err instanceof WorkflowError ? err.message : "Intake could not be stored. Please retry.",
      },
      { status: err instanceof WorkflowError ? err.status : 503 }
    );
  }
}
