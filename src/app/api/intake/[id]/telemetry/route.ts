import { NextRequest, NextResponse } from "next/server";
import { getVaultRecord } from "@/lib/vault-store";
import { generatePseudonymousAlias } from "@/lib/crypto";

export async function GET(
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

  const crmAlias = generatePseudonymousAlias(record.id);

  const hubspotStageMap: Record<string, string> = {
    SCRUBBED_DISPATCHED: "Syncing with n8n AI Agent...",
    WEBHOOK_RETRY_PENDING: "Outbox Paused — Webhook Retry Pending",
    AI_TRIAGED: "1. AI Triaged - Pending Review",
    CRM_SYNCED: "1. AI Triaged - Pending Review",
    TRIAGE_FAILED_MANUAL_REVIEW: "DLQ Alert — Manual Clinician Triage Queue",
    EMERGENCY_HALTED: "4. Closed Lost - Referred Out / Emergency 911",
    APPROVED: "2. Approved - Onboarding Sent",
    ONBOARDED: "3. Closed Won - Appointment Booked",
  };

  return NextResponse.json({
    patientId: record.id,
    status: record.status,
    lastError: record.lastError,
    stage1_redaction: {
      scrubbedSymptoms: record.scrubbedSymptoms,
      redactedSpans: record.redactedSpansJson,
      redactionCount: record.redactedSpansJson.length,
    },
    stage2_vault: {
      emailHash: record.emailHash,
      encryptedPiiJson: record.encryptedPiiJson,
      encryptedSymptoms: record.encryptedSymptoms,
      encryptedKycJson: record.encryptedKycJson,
      onboardingTokenHash: record.onboardingTokenHash,
      tokenExpiresAt: record.tokenExpiresAt,
      tokenUsedAt: record.tokenUsedAt,
      consents: record.consents,
      auditLogs: record.auditLogs,
    },
    stage3_n8nWebhook: record.outboundWebhookDebug ?? null,
    stage4_aiAndHubspot: {
      aiTriage: record.aiTriageJson,
      crmAlias,
      hubspotContactId: record.hubspotContactId,
      hubspotDealId: record.hubspotDealId,
      hubspotDealStage: hubspotStageMap[record.status] ?? record.status,
      hubspotContactLifecycle:
        record.status === "ONBOARDED" ? "customer" : "lead",
      vaultReviewUrl: `/admin/vault/${record.id}`,
      rawOnboardingTokenForDemo: record.rawOnboardingTokenForDemo ?? null,
      blindNotification: record.blindNotificationDebug ?? null,
      appointmentSlot: record.appointmentSlot,
      assignedDoctor: record.assignedDoctor,
    },
  });
}
