import { afterAll, describe, expect, it, vi } from "vitest";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import {
  processPatientIntake,
  applyN8nTriageCallback,
  approvePatientForOnboarding,
  completePatientOnboarding,
  getVaultRecord,
  retryPatientDispatch,
} from "../lib/vault-store";
import { runDeterministicTriageAnalysis } from "../lib/triage";
import { prisma } from "../lib/prisma";
import { dispatchPendingOutbox } from "../lib/outbox";
import { dispatchBlindNotification } from "../lib/integrations";

afterAll(() => prisma.$disconnect());
async function fixture(symptoms = "An irregular mole appeared on the arm.") {
  return processPatientIntake(
    {
      firstName: "Synthetic",
      lastName: "Patient",
      email: `${crypto.randomUUID()}@example.test`,
      phone: "202-555-0144",
      dob: "1990-01-01",
      insuranceProvider: "Aetna_PPO",
      memberId: "AET1234567",
      groupNumber: "TEST",
      rawSymptoms: symptoms,
      hipaaAccepted: true,
      tcpaSmsAccepted: true,
      policyVersion: "TEST",
    },
    "127.0.0.1",
    "Integration Test",
  );
}
describe("Durable lifecycle invariants", () => {
  it("persists encrypted intake, consent, and outbox across independent clients", async () => {
    const intake = await fixture();
    const independent = new PrismaClient();
    try {
      const record = await independent.patientVault.findUniqueOrThrow({
        where: { id: intake.patientId },
        include: { consents: true, deliveries: true },
      });
      expect(record.encryptedPiiJson).toMatch(/^v1:/);
      expect(record.encryptedPiiJson).not.toContain("Synthetic");
      expect(JSON.stringify(record.redactedSpansJson)).not.toContain(
        '"original"',
      );
      expect(record.consents).toHaveLength(2);
      expect(record.deliveries).toHaveLength(1);
      expect(record.deliveries[0].status).toBe("PENDING");
    } finally {
      await independent.$disconnect();
    }
  });
  it("serializes concurrent token burns and ignores late triage callbacks", async () => {
    const intake = await fixture();
    const triage = runDeterministicTriageAnalysis("mole", "Aetna_PPO");
    const callback = {
      patient_uuid: intake.patientId,
      status: "AI_TRIAGED" as const,
      ai_triage: triage,
    };
    await applyN8nTriageCallback(callback);
    const approval = await approvePatientForOnboarding(
      intake.patientId,
      "dr_chen_demo",
      "Demo Clinician",
    );
    const request = {
      rawToken: approval!.rawToken,
      kycIdType: "DEMO_CARD",
      kycCardNumberLast4: "1234",
      nppSignatureText: "Synthetic Patient",
      appointmentSlotIso: new Date(Date.now() + 86400000).toISOString(),
    };
    const results = await Promise.all([
      completePatientOnboarding(request),
      completePatientOnboarding(request),
    ]);
    expect(results.map((r) => r.code).sort()).toEqual([200, 410]);
    await applyN8nTriageCallback(callback);
    const record = await getVaultRecord(intake.patientId);
    expect(record?.status).toBe("ONBOARDED");
    expect(record?.encryptedOnboardingToken).toBeNull();
    expect(
      record?.auditLogs.filter((l) => l.action === "ONBOARDING_COMPLETED"),
    ).toHaveLength(1);
    expect(
      record?.deliveries.filter((d) => d.stage === "ONBOARDING_COMPLETE"),
    ).toHaveLength(1);
  });
  it("rejects emergency approval on the server", async () => {
    const intake = await fixture("Crushing chest pain and cannot breathe.");
    await applyN8nTriageCallback({
      patient_uuid: intake.patientId,
      status: "AI_TRIAGED",
      ai_triage: runDeterministicTriageAnalysis(
        "crushing chest pain",
        "Aetna_PPO",
      ),
    });
    await expect(
      approvePatientForOnboarding(
        intake.patientId,
        "dr_chen_demo",
        "Demo Clinician",
      ),
    ).rejects.toThrow("Emergency");
  });
  it("recovers a network failure and an expired worker lease", async () => {
    const intake = await fixture();
    const previousFallback = process.env.DEMO_SIMULATE_N8N_IF_SLEEPING;
    process.env.DEMO_SIMULATE_N8N_IF_SLEEPING = "false";
    const delivery = await prisma.outboxDelivery.findFirstOrThrow({
      where: { patientId: intake.patientId },
    });
    const mocked = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Synthetic network outage"))
      .mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", mocked);
    try {
      await dispatchPendingOutbox(1, intake.patientId);
      const failed = await prisma.outboxDelivery.findUniqueOrThrow({
        where: { id: delivery.id },
      });
      expect(failed.status).toBe("PENDING");
      expect(failed.attempts).toBe(1);
      expect((await getVaultRecord(intake.patientId))?.status).toBe(
        "WEBHOOK_RETRY_PENDING",
      );
      // Model a process crash after claiming the retry: a new worker can reclaim it.
      await prisma.outboxDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "PROCESSING",
          leaseUntil: new Date(0),
          availableAt: new Date(0),
        },
      });
      await dispatchPendingOutbox(1, intake.patientId);
      const recovered = await prisma.outboxDelivery.findUniqueOrThrow({
        where: { id: delivery.id },
      });
      expect(recovered.status).toBe("SENT");
      expect(recovered.attempts).toBe(2);
      expect(mocked).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
      if (previousFallback === undefined)
        delete process.env.DEMO_SIMULATE_N8N_IF_SLEEPING;
      else process.env.DEMO_SIMULATE_N8N_IF_SLEEPING = previousFallback;
    }
  });
  it("finishes triage deliveries after clinician approval and purges an expired capability", async () => {
    const intake = await fixture();
    await applyN8nTriageCallback({
      patient_uuid: intake.patientId,
      status: "AI_TRIAGED",
      ai_triage: runDeterministicTriageAnalysis("mole", "Aetna_PPO"),
    });
    await approvePatientForOnboarding(
      intake.patientId,
      "dr_chen_demo",
      "Demo Clinician",
    );
    await prisma.patientVault.update({
      where: { id: intake.patientId },
      data: { tokenExpiresAt: new Date(0) },
    });
    await prisma.outboxDelivery.updateMany({
      where: { patientId: intake.patientId, stage: "TRIAGE" },
      data: { status: "SENT", availableAt: new Date(0), attempts: 1 },
    });
    const mocked = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", mocked);
    try {
      await dispatchPendingOutbox(10, intake.patientId);
      const triageDelivery = await prisma.outboxDelivery.findFirstOrThrow({
        where: { patientId: intake.patientId, stage: "TRIAGE" },
      });
      expect(triageDelivery.status).toBe("COMPLETED"); // clinician has progressed past triage
      expect(triageDelivery.attempts).toBe(1);
      expect(
        (await getVaultRecord(intake.patientId))?.encryptedOnboardingToken,
      ).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("moves an exhausted callback timeout to manual review and permits an explicit retry", async () => {
    const intake = await fixture();
    await prisma.outboxDelivery.updateMany({
      where: { patientId: intake.patientId },
      data: { status: "SENT", attempts: 1, availableAt: new Date(0) },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 202 })),
    );
    try {
      await dispatchPendingOutbox(1, intake.patientId);
    } finally {
      vi.unstubAllGlobals();
    }
    expect(
      (
        await prisma.outboxDelivery.findFirstOrThrow({
          where: { patientId: intake.patientId },
        })
      ).attempts,
    ).toBe(2);
    await prisma.outboxDelivery.updateMany({
      where: { patientId: intake.patientId },
      data: { status: "SENT", attempts: 5, availableAt: new Date(0) },
    });
    await dispatchPendingOutbox(1, intake.patientId);
    expect((await getVaultRecord(intake.patientId))?.status).toBe(
      "TRIAGE_FAILED_MANUAL_REVIEW",
    );
    expect(
      (
        await prisma.outboxDelivery.findFirstOrThrow({
          where: { patientId: intake.patientId },
        })
      ).status,
    ).toBe("FAILED");
    await retryPatientDispatch(intake.patientId);
    expect((await getVaultRecord(intake.patientId))?.status).toBe(
      "SCRUBBED_DISPATCHED",
    );
    expect(
      (
        await prisma.outboxDelivery.findFirstOrThrow({
          where: { patientId: intake.patientId },
        })
      ).attempts,
    ).toBe(0);
  });
  it("renews an expired emailed invitation without reusing its delivery status", async () => {
    const intake = await fixture();
    await applyN8nTriageCallback({
      patient_uuid: intake.patientId,
      status: "AI_TRIAGED",
      ai_triage: runDeterministicTriageAnalysis("mole", "Aetna_PPO"),
    });
    const original = await approvePatientForOnboarding(
      intake.patientId,
      "dr_chen_demo",
      "Demo Clinician",
    );
    await prisma.patientVault.update({
      where: { id: intake.patientId },
      data: {
        notificationMode: "GMAIL_SENT",
        encryptedOnboardingToken: null,
        tokenExpiresAt: new Date(0),
      },
    });
    const renewed = await approvePatientForOnboarding(
      intake.patientId,
      "dr_chen_demo",
      "Demo Clinician",
    );
    expect(renewed?.tokenHash).not.toBe(original?.tokenHash);
    expect(renewed?.record.notificationMode).toBeNull();
    expect(renewed?.record.encryptedOnboardingToken).toMatch(/^v1:/);
  });
  it("enforces audit immutability in PostgreSQL inside rollback-only transactions", async () => {
    const intake = await fixture();
    for (const sql of [
      'UPDATE "AuditLog" SET "actorId" = \'tamper\' WHERE "patientId" = $1::uuid',
      'DELETE FROM "AuditLog" WHERE "patientId" = $1::uuid',
    ]) {
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(sql, intake.patientId);
          throw new Error(
            "Rollback: audit trigger unexpectedly allowed mutation",
          );
        }),
      ).rejects.toThrow("append-only");
    }
  });
  it("reconciles an accepted Gmail delivery before retrying an ambiguous send", async () => {
    const intake = await fixture();
    await applyN8nTriageCallback({
      patient_uuid: intake.patientId,
      status: "AI_TRIAGED",
      ai_triage: runDeterministicTriageAnalysis("mole", "Aetna_PPO"),
    });
    const approval = await approvePatientForOnboarding(
      intake.patientId,
      "dr_chen_demo",
      "Demo Clinician",
    );
    vi.stubEnv("GMAIL_REFRESH_TOKEN", "");
    vi.stubEnv("GMAIL_ACCESS_TOKEN", "synthetic-access-token");
    vi.stubEnv("GMAIL_TEST_RECIPIENT", "synthetic@example.test");
    vi.stubEnv("AEGIS_DEMO_MODE", "true");
    const mocked = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ messages: [{ id: "accepted-before-timeout" }] }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", mocked);
    try {
      const result = await dispatchBlindNotification(intake.patientId);
      expect(result.mode).toBe("GMAIL_SENT");
      expect(mocked).toHaveBeenCalledTimes(1); // search only; no second send
      expect(decodeURIComponent(String(mocked.mock.calls[0][0]))).toContain(
        `subject:"AEGIS-${approval!.tokenHash.slice(0, 32)}"`,
      );
      const record = await getVaultRecord(intake.patientId);
      expect(record?.encryptedOnboardingToken).toBeNull();
      expect(
        record?.auditLogs.filter((a) => a.action === "BLIND_NOTIFY_SENT"),
      ).toHaveLength(1);
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
});
