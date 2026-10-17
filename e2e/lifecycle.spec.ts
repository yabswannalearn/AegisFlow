import { test, expect } from "@playwright/test";
import crypto from "node:crypto";
test("live Gemini, real CRM, clinician review, onboarding, and token replay protection", async ({
  page,
  playwright,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: /Routine Dermatology/ }).click();
  await page
    .getByRole("textbox", { name: "Email address", exact: true })
    .fill(`e2e-${crypto.randomUUID()}@example.test`);
  const intakeResponse = page.waitForResponse(
    (r) => r.url().endsWith("/api/intake") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Submit Demo Intake", exact: true })
    .click();
  const response = await intakeResponse;
  expect(response.status()).toBe(202);
  const intake = await response.json();
  await expect
    .poll(
      async () =>
        (
          await (
            await page.request.get(`/api/intake/${intake.patientId}/telemetry`)
          ).json()
        ).status,
      { timeout: 120000, intervals: [1000, 2000] },
    )
    .toBe("CRM_SYNCED");
  const telemetry = await (
    await page.request.get(`/api/intake/${intake.patientId}/telemetry`)
  ).json();
  expect(telemetry.executionMode).toBe("LIVE_GEMINI_N8N");
  expect(telemetry.stage4_aiAndHubspot.hubspotDealId).toMatch(/^\d+$/);
  expect(telemetry.stage4_aiAndHubspot.aiTriage.recommended_specialty).toBe(
    "Dermatology",
  );
  expect(JSON.stringify(telemetry)).not.toContain('"original"');
  expect(telemetry.stage4_aiAndHubspot.rawOnboardingTokenForDemo).toBeNull();
  const outsider = await playwright.request.newContext({
    baseURL: "http://localhost:3005",
  });
  expect(
    (await outsider.get(`/api/intake/${intake.patientId}/telemetry`)).status(),
  ).toBe(401);
  await outsider.dispose();
  await expect(
    page.getByText("Vault Status: CRM_SYNCED", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/intake-live.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /Open Clinician Vault/ }).click();
  await expect(page).toHaveURL(/\/admin\/vault\//);
  await expect(page.getByText("Marcus Vance", { exact: true })).toBeVisible();
  await page
    .getByRole("button", {
      name: "Approve & Create Onboarding Invitation",
      exact: true,
    })
    .click();
  const invitation = page.getByRole("link", {
    name: /Open 3-Step Patient Onboarding Portal/,
  });
  await expect(invitation).toBeVisible();
  await expect
    .poll(
      async () => {
        const state = await (
          await page.request.get(`/api/intake/${intake.patientId}/telemetry`)
        ).json();
        return {
          crmSyncStage: state.crmSyncStage,
          notificationMode: state.notificationMode,
        };
      },
      { timeout: 90000, intervals: [1000, 2000] },
    )
    .toEqual({ crmSyncStage: "APPROVED", notificationMode: "PREVIEW_ONLY" });
  const onboardingPath = await invitation.getAttribute("href");
  await page.screenshot({
    path: "test-results/clinician-review.png",
    fullPage: true,
  });
  await invitation.click();
  await page.getByRole("button", { name: /Continue to Step 2/ }).click();
  await page
    .getByRole("textbox", { name: "Demo signature", exact: true })
    .fill("Synthetic Patient");
  await page.getByRole("button", { name: /Continue to Step 3/ }).click();
  await page.getByRole("button", { name: /Confirm Appointment/ }).click();
  await expect(
    page.getByRole("heading", {
      name: "Telehealth Onboarding & Appointment Confirmed",
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Telehealth Onboarding & Appointment Confirmed",
    }),
  ).toBeVisible();
  const replay = await page.request.post(`/api${onboardingPath}/complete`, {
    data: {
      kycIdType: "DEMO",
      kycCardNumberLast4: "1234",
      nppSignatureText: "Synthetic Patient",
      appointmentSlotIso: new Date(Date.now() + 86400000).toISOString(),
    },
  });
  expect(replay.status()).toBe(410);
  await expect
    .poll(
      async () =>
        (
          await (
            await page.request.get(`/api/intake/${intake.patientId}/telemetry`)
          ).json()
        ).crmSyncStage,
      { timeout: 90000 },
    )
    .toBe("ONBOARDED");
  await page.screenshot({
    path: "test-results/appointment-confirmed.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("a critical model result stops onboarding and public APIs reject unsigned calls", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: /Emergency 911 Short-Circuit/ })
    .click();
  const pending = page.waitForResponse(
    (r) => r.url().endsWith("/api/intake") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Submit Demo Intake", exact: true })
    .click();
  const intake = await (await pending).json();
  await expect
    .poll(
      async () =>
        (
          await (
            await page.request.get(`/api/intake/${intake.patientId}/telemetry`)
          ).json()
        ).status,
      { timeout: 120000 },
    )
    .toBe("EMERGENCY_HALTED");
  await page.request.post("/api/auth/demo-session");
  expect(
    (
      await page.request.post(`/api/vault/${intake.patientId}/approve`, {
        data: {},
      })
    ).status(),
  ).toBe(409);
  expect((await page.request.get("/api/mock/insurance")).status()).toBe(401);
  expect(
    (
      await page.request.post("/api/webhooks/n8n-callback", { data: {} })
    ).status(),
  ).toBe(401);
  await page.screenshot({
    path: "test-results/emergency-halt.png",
    fullPage: true,
  });
});
