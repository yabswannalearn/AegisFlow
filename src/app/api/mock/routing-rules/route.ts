import { NextRequest, NextResponse } from "next/server";
import { requiredSecret, safeEqual } from "@/lib/config";

export async function GET(request: NextRequest) {
  const expectedKey =
    requiredSecret("AEGIS_TOOL_API_KEY", "aegis-dev-internal-tool-api-key-2026");
  const providedKey = request.headers.get("x-aegis-tool-key");

  if (!safeEqual(providedKey, expectedKey)) {
    return NextResponse.json(
      { error: "Unauthorized n8n tool key" },
      { status: 401 }
    );
  }

  return NextResponse.json({
    clinical_routing_version: "2026.10",
    emergency_short_circuit_policy:
      "Any CRITICAL urgency (crushing chest pain, acute dyspnea, stroke signs, suicidal ideation) halts standard onboarding and triggers immediate 911 escalation (ADR-005).",
    specialties: [
      {
        specialty: "Cardiology",
        indicators: [
          "chest tightness",
          "palpitations",
          "arrhythmia",
          "hypertension",
        ],
        default_urgency: "HIGH",
        onboarding_track: "FastTrack",
        lead_clinician: "Dr. Sarah Chen, MD (Cardiology)",
      },
      {
        specialty: "Dermatology",
        indicators: ["mole", "rash", "eczema", "hives", "lesion"],
        default_urgency: "LOW",
        onboarding_track: "Standard",
        lead_clinician: "Dr. Marcus Vance, MD (Dermatology)",
      },
      {
        specialty: "Neurology",
        indicators: ["migraine", "vertigo", "dizziness", "numbness"],
        default_urgency: "MEDIUM",
        onboarding_track: "Standard",
        lead_clinician: "Dr. Elena Rostova, MD (Neurology)",
      },
      {
        specialty: "General Medicine",
        indicators: ["fever", "cough", "fatigue", "general checkup"],
        default_urgency: "MEDIUM",
        onboarding_track: "Standard",
        lead_clinician: "Dr. Sarah Chen, MD (Internal Medicine)",
      },
    ],
  });
}
