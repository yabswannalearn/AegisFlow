import { prisma } from "./prisma";
import { decryptPhi } from "./crypto";
import { signWebhookPayload } from "./hmac";
import { audit, simulateTriage } from "./vault-store";
import { isDemoMode } from "./config";

const stages: Record<string, string> = {
  TRIAGE: "N8N_TRIAGE_WEBHOOK_URL",
  ONBOARDING_DISPATCH: "N8N_ONBOARDING_DISPATCH_WEBHOOK_URL",
  ONBOARDING_COMPLETE: "N8N_ONBOARDING_COMPLETE_WEBHOOK_URL",
};
export async function dispatchPendingOutbox(limit = 10, patientId?: string) {
  const now = new Date();
  await prisma.patientVault.updateMany({
    where: {
      encryptedOnboardingToken: { not: null },
      tokenExpiresAt: { lte: now },
    },
    data: { encryptedOnboardingToken: null },
  });
  // A 202 acknowledgement does not prove downstream execution completed. Reconcile
  // accepted deliveries after the callback deadline, including after process restarts.
  const accepted = await prisma.outboxDelivery.findMany({
    where: { patientId, status: "SENT", availableAt: { lte: now } },
    include: { patient: true },
    take: limit,
  });
  for (const delivery of accepted) {
    const record = delivery.patient;
    const complete =
      delivery.stage === "TRIAGE"
        ? [
            "CRM_SYNCED",
            "EMERGENCY_HALTED",
            "TRIAGE_FAILED_MANUAL_REVIEW",
            "APPROVED",
            "ONBOARDED",
          ].includes(record.status)
        : delivery.stage === "ONBOARDING_COMPLETE"
          ? record.crmSyncStage === "ONBOARDED"
          : record.status === "ONBOARDED" ||
            (["APPROVED", "ONBOARDED"].includes(record.crmSyncStage ?? "") &&
              ["GMAIL_SENT", "PREVIEW_ONLY"].includes(
                record.notificationMode ?? "",
              ));
    await prisma.$transaction(async (tx) => {
      const changed = await tx.outboxDelivery.updateMany({
        where: { id: delivery.id, status: "SENT" },
        data: {
          status: complete
            ? "COMPLETED"
            : delivery.attempts >= 5
              ? "FAILED"
              : "PENDING",
          lastError: complete ? null : "CALLBACK_DEADLINE_EXCEEDED",
        },
      });
      if (
        changed.count &&
        !complete &&
        delivery.attempts >= 5 &&
        delivery.stage === "TRIAGE"
      ) {
        const failed = await tx.patientVault.updateMany({
          where: {
            id: delivery.patientId,
            status: {
              in: [
                "SCRUBBED_DISPATCHED",
                "WEBHOOK_RETRY_PENDING",
                "AI_TRIAGED",
              ],
            },
          },
          data: {
            status: "TRIAGE_FAILED_MANUAL_REVIEW",
            lastError: "CALLBACK_DEADLINE_EXCEEDED",
          },
        });
        if (failed.count)
          await audit(
            tx,
            delivery.patientId,
            "TRIAGE_FAILED",
            "OUTBOX_WORKER",
            "N8N_SYSTEM",
            { reason: "CALLBACK_DEADLINE_EXCEEDED" },
          );
      }
    });
  }
  const deliveries = await prisma.outboxDelivery.findMany({
    where: {
      patientId,
      OR: [
        { status: "PENDING", availableAt: { lte: now } },
        { status: "PROCESSING", leaseUntil: { lt: now } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  for (const delivery of deliveries) {
    const claim = await prisma.outboxDelivery.updateMany({
      where: {
        id: delivery.id,
        OR: [
          { status: "PENDING" },
          { status: "PROCESSING", leaseUntil: { lt: now } },
        ],
      },
      data: {
        status: "PROCESSING",
        leaseUntil: new Date(Date.now() + 60000),
        attempts: { increment: 1 },
      },
    });
    if (!claim.count) continue;
    const rawBody = decryptPhi(delivery.encryptedPayload);
    try {
      const url = process.env[stages[delivery.stage]];
      if (!url) throw new Error("WEBHOOK_NOT_CONFIGURED");
      const response = await fetch(url, {
        method: "POST",
        body: rawBody,
        headers: {
          "content-type": "application/json",
          ...signWebhookPayload(rawBody),
        },
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) throw new Error(`WEBHOOK_HTTP_${response.status}`);
      await prisma.outboxDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "SENT",
          leaseUntil: null,
          lastError: null,
          availableAt: new Date(Date.now() + 120000),
        },
      });
    } catch {
      if (
        delivery.stage === "TRIAGE" &&
        isDemoMode() &&
        process.env.DEMO_SIMULATE_N8N_IF_SLEEPING === "true"
      ) {
        await simulateTriage(
          delivery.patientId,
          JSON.parse(rawBody).insurance_provider,
        );
        await prisma.outboxDelivery.update({
          where: { id: delivery.id },
          data: { status: "SIMULATED", leaseUntil: null },
        });
      } else {
        await prisma.$transaction(async (tx) => {
          await tx.outboxDelivery.update({
            where: { id: delivery.id },
            data: {
              status: delivery.attempts >= 4 ? "FAILED" : "PENDING",
              leaseUntil: null,
              availableAt: new Date(
                Date.now() + Math.min(300000, 2000 * 2 ** delivery.attempts),
              ),
              lastError: "WEBHOOK_DELIVERY_FAILED",
            },
          });
          if (delivery.stage === "TRIAGE") {
            const changed = await tx.patientVault.updateMany({
              where: {
                id: delivery.patientId,
                status: {
                  in: ["SCRUBBED_DISPATCHED", "WEBHOOK_RETRY_PENDING"],
                },
              },
              data: {
                status: "WEBHOOK_RETRY_PENDING",
                lastError: "WEBHOOK_DELIVERY_FAILED",
              },
            });
            if (changed.count)
              await audit(
                tx,
                delivery.patientId,
                "TRIAGE_FAILED",
                "OUTBOX_WORKER",
                "N8N_SYSTEM",
                { retryPending: true },
              );
          }
        });
      }
    }
  }
  return deliveries.length;
}
