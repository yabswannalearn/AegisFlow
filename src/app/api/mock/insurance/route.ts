import { NextRequest, NextResponse } from "next/server";
import { evaluateInsuranceEligibility } from "@/lib/vault-store";

export async function GET(request: NextRequest) {
  const expectedKey =
    process.env.AEGIS_TOOL_API_KEY ?? "aegis-dev-internal-tool-api-key-2026";
  const providedKey = request.headers.get("x-aegis-tool-key");

  if (providedKey && providedKey !== expectedKey) {
    return NextResponse.json(
      { error: "Unauthorized n8n tool key" },
      { status: 401 }
    );
  }

  const payer =
    request.nextUrl.searchParams.get("payer") ??
    request.nextUrl.searchParams.get("insurance_provider") ??
    "Aetna_PPO";

  const eligibility = evaluateInsuranceEligibility(payer);

  return NextResponse.json({
    payer,
    insurance_verified: eligibility.verified,
    copay_estimate_usd: eligibility.copayUsd,
    plan_tier: eligibility.planTier,
    prior_auth_required: eligibility.priorAuthRequired,
    checked_at: new Date().toISOString(),
  });
}
