# Manual test walkthrough

Use synthetic data only. The running demo is at [http://localhost:3005](http://localhost:3005). The workflows run in the existing [n8n instance on port 5678](http://localhost:5678). Signing into the n8n editor is optional for testing the app; published webhooks run independently of your editor login.

## Complete a normal case

1. Open the application and select **Routine Dermatology**. The sample fills the form and demo consent checkboxes. For a fresh case, change **Email address** to a unique synthetic address, such as `manual-001@example.test`. Increment the number for later runs; identical submissions in the same browser are intentionally deduplicated.
2. Click **Submit Demo Intake**. The request is accepted immediately while the workflow continues. Allow up to two minutes for external services. In the workflow inspector, expect **LIVE_GEMINI_N8N**, **Vault Status: CRM_SYNCED**, a Dermatology recommendation, and numeric HubSpot contact/deal IDs. The inspector shows encrypted vault fields and scrubbed outbound symptoms.
3. Click **Open Clinician Vault**. This action signs in as the demo clinician. If a sign-in gate appears, use **Sign in as Demo Clinician**. Review the sample patient, AI recommendation, assigned specialist, and audit entries, then click **Approve & Create Onboarding Invitation**.
4. Click **Open 3-Step Patient Onboarding Portal**. Use the demo details, continue to Step 2, enter a synthetic signature, and continue to Step 3. Choose a future slot and click **Confirm Appointment**.
5. Expect **Telehealth Onboarding & Appointment Confirmed**. Refresh: the same link should show the receipt. The invitation has been consumed and cannot create a second booking. The background completion workflow advances the HubSpot deal to the completed onboarding stage.

The current demo uses **PREVIEW_ONLY** notification delivery: approval shows an invitation on screen and does not send email. One real Gmail self-test was verified separately. No email account or actual patient address is needed for this walkthrough.

## Try the emergency path

Return to the home page, choose **Emergency 911 Short-Circuit**, and submit the synthetic preset. Expect an emergency advisory and **EMERGENCY_HALTED**. Approval and onboarding are blocked for that case. This scenario demonstrates routing behavior; it is not a clinical assessment.

## Inspect the workflows

The three webhook workflows are published. The fourth is an Error Trigger workflow and does not expose a webhook:

- [Gemini triage agent](http://localhost:5678/workflow/TCc5M9TUgKMpOJHN)
- [Clinician approval and blind notification dispatch](http://localhost:5678/workflow/AegisOnboardingDispatch02)
- [Appointment completion and HubSpot sync](http://localhost:5678/workflow/AegisOnboardingComplete03)
- [Sanitized dead-letter handler](http://localhost:5678/workflow/AegisErrorDlq04)

The editor uses your existing n8n login. Execution payload saving is disabled for these workflows, so use the app's inspector and audit trail to follow a case.

If an external service is temporarily unavailable, the inspector shows pending delivery/retry state. Keep Docker Desktop running. See [operations](OPERATIONS.md#use-an-existing-n8n-instance-on-port-5678) for startup commands and [verification](VERIFICATION.md) for recorded checks.
