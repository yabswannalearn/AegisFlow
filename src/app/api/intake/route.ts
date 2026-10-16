import { NextRequest, NextResponse } from "next/server";
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
      userAgent
    );

    return NextResponse.json(
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
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to process patient intake",
        message: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
