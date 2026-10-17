import { test, expect } from "@playwright/test";
test.use({ video: "off", reducedMotion: "reduce" });

for (const [name, width, height] of [
  ["desktop", 1440, 1000],
  ["mobile", 390, 844],
] as const) {
  test(`${name} workspace remains readable and keyboard-operable`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Every intake. A clearer next step." }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Routine Dermatology/ }).click();
    await expect(
      page.getByRole("textbox", { name: "First name", exact: true }),
    ).toHaveValue("Marcus");
    const inspector = page.getByRole("button", {
      name: "Workflow inspector",
      exact: true,
    });
    await inspector.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Behind the handoff" }),
    ).toHaveCount(0);
    await inspector.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Behind the handoff" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/frontend-${name}.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
  test(`${name} clinician and onboarding layouts fit their content`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    const patientId = "10000000-1111-4111-8111-000000000001";
    // Visual fixtures isolate responsive rendering from external services.
    await page.route(`**/api/vault/${patientId}/approve`, (route) =>
      route.fulfill({
        json: {
          patientId,
          status: "CRM_SYNCED",
          clinician: { name: "Dr. Sarah Chen (Demo)" },
          decryptedPii: {
            firstName: "Synthetic",
            lastName: "Patient",
            email: "synthetic@example.test",
            phone: "202-555-0144",
            dob: "1990-01-01",
            insuranceProvider: "Aetna_PPO",
            memberId: "DEMO123456",
          },
          decryptedSymptoms:
            "An itchy rash appeared on the forearm two weeks ago. No other symptoms are present.",
          scrubbedSymptoms:
            "An itchy rash appeared on the forearm two weeks ago.",
          aiTriage: {
            urgency_level: "LOW",
            recommended_specialty: "Dermatology",
            triage_rationale_redacted:
              "A persistent mild rash is appropriate for routine dermatology review. This fixture demonstrates the review layout.",
            insurance_verified: true,
            copay_estimate_usd: 35,
          },
          auditLogs: [
            {
              id: "fixture-audit",
              action: "PHI_DECRYPTED_VIEW",
              actorId: "dr_chen_demo",
              createdAt: "2026-10-16T06:00:00Z",
            },
          ],
          hubspotDealId: "visual-fixture",
          hubspotContactId: "visual-fixture",
        },
      }),
    );
    await page.goto(`/admin/vault/${patientId}`);
    await expect(
      page.getByRole("heading", { name: "Synthetic Patient", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/frontend-fixture-clinician-${name}.png`,
      fullPage: true,
    });
    await page.route("**/api/onboarding/frontend-preview/complete", (route) =>
      route.fulfill({
        json: {
          valid: true,
          patientId,
          recommendedSpecialty: "Dermatology",
          assignedDoctor: "Dr. Marcus Vance, MD (Dermatology)",
          copayEstimateUsd: 35,
        },
      }),
    );
    await page.goto("/onboarding/frontend-preview");
    await expect(
      page.getByRole("heading", { name: "Confirm your details", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Continue to Step 2/ }).click();
    await page
      .getByRole("textbox", { name: "Demo signature", exact: true })
      .fill("Synthetic Patient");
    await page.getByRole("button", { name: /Continue to Step 3/ }).click();
    await expect(
      page.getByRole("button", { name: "Confirm Appointment", exact: true }),
    ).toBeEnabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/frontend-fixture-onboarding-${name}.png`,
      fullPage: true,
    });
  });
}
