import { NextRequest, NextResponse } from "next/server";
import { getVaultRecord } from "@/lib/vault-store";
import { generatePseudonymousAlias, decryptPhi } from "@/lib/crypto";
import { canInspect } from "@/lib/access";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const record = await getVaultRecord(id);
  if (!record || !await canInspect(request, record)) return NextResponse.json({ error: "Inspector session required" }, { status: 401 });
  const delivery = record.deliveries.find(d => d.stage === "TRIAGE");
  const labels: Record<string,string> = { CRM_SYNCED: "AI Triaged - Pending Review", AI_TRIAGED: "Triaged; CRM sync pending", APPROVED: "Clinician Approved", ONBOARDED: "Appointment Booked", EMERGENCY_HALTED: "Emergency escalation", WEBHOOK_RETRY_PENDING: "Dispatch retry pending", TRIAGE_FAILED_MANUAL_REVIEW: "Manual review required" };
  return NextResponse.json({ patientId: id, status: record.status, lastError: record.lastError,
    executionMode: record.executionMode, crmSyncStage: record.crmSyncStage, notificationMode: record.notificationMode,
    deliveries: record.deliveries.map(d => ({ stage: d.stage, status: d.status, attempts: d.attempts, lastError: d.lastError })),
    stage1_redaction: { scrubbedSymptoms: record.scrubbedSymptoms, redactedSpans: record.redactedSpansJson, redactionCount: Array.isArray(record.redactedSpansJson) ? record.redactedSpansJson.length : 0 },
    stage2_vault: { emailHash: record.emailHash, encryptedPiiJson: record.encryptedPiiJson, encryptedSymptoms: record.encryptedSymptoms, encryptedKycJson: record.encryptedKycJson,
      onboardingTokenHash: record.onboardingTokenHash, tokenExpiresAt: record.tokenExpiresAt, tokenUsedAt: record.tokenUsedAt,
      consents: record.consents.map(({ id, consentType, policyVersion, createdAt }) => ({ id, consentType, policyVersion, createdAt })),
      auditLogs: record.auditLogs.map(({ id, actorId, actorRole, action, metadata, createdAt }) => ({ id, actorId, actorRole, action, metadata, createdAt })) },
    stage3_n8nWebhook: delivery ? { url: "n8n /webhook/aegis-triage", headers: { "x-aegis-signature": "[withheld]", "x-aegis-timestamp": "[withheld]" }, payload: JSON.parse(decryptPhi(delivery.encryptedPayload)) } : null,
    stage4_aiAndHubspot: { aiTriage: record.aiTriageJson, crmAlias: generatePseudonymousAlias(id), hubspotContactId: record.hubspotContactId, hubspotDealId: record.hubspotDealId,
      hubspotDealStage: `${labels[record.status] ?? record.status}${record.crmSyncStage ? " | CRM: " + record.crmSyncStage : " | CRM pending"}`,
      hubspotContactLifecycle: record.crmSyncStage === "ONBOARDED" ? "customer" : "lead", vaultReviewUrl: `/admin/vault/${id}`,
      rawOnboardingTokenForDemo: null, blindNotification: null, appointmentSlot: record.appointmentSlot, assignedDoctor: record.assignedDoctor }
  }, { headers: { "Cache-Control": "no-store" } });
}
