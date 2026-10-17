# Verification record — 2026-10-16

All patient inputs in these checks were synthetic. Tests used PostgreSQL 16, Next.js 15.5.28, n8n 2.29.10, real Gemini (`models/gemini-3.1-flash-lite`), and a dedicated HubSpot pipeline. Initial verification used an isolated n8n instance; the live lifecycle was subsequently verified against the user's existing instance on port 5678.

| Check | Result | Evidence |
| --- | --- | --- |
| Unit/security tests | 11 passed | AES-GCM tampering, HMAC/replay, JWT, 25 synthetic scrub examples, alternate-email redaction, exported n8n signature verification, and proxy-origin/cross-site rejection |
| PostgreSQL integration tests | 12 passed | Independent-client persistence, concurrent token burn, late callback monotonicity, emergency block, real audit trigger rejection, retry/lease recovery, expiry cleanup, Gmail reconciliation, callback exhaustion, expired-invitation renewal |
| Production build | Passed | Docker standalone image runs as uid 1000; migration image runs prisma migrate deploy against the preserved database |
| Live browser lifecycle | 2 passed on final Docker build | Gemini → real contact/deal → clinician review → onboarding → refresh → rejected replay; emergency approval denied |
| AI routing examples | 4/4 passed | [Recorded output](agent-evaluation.json): routine, higher urgency, emergency, injection attempt |
| Gmail self-test | Delivered | One matching message with SENT and INBOX labels in the connected account; encrypted capability cleared after send |
| Docker relocation | Passed | Both virtual disks verified before cutover; existing containers/volumes and the pre-migration case preserved |
| Responsive UI | 4 passed on final Docker build | Desktop/mobile overflow, keyboard inspector controls, clinician and onboarding fixture layouts |
| Application restart | Passed | The pre-restart intake remained accessible with its original browser cookie and retained its live execution and delivery status |

The Playwright run generates `intake-live.png`, `clinician-review.png`, `appointment-confirmed.png`, `emergency-halt.png`, and videos under ignored `test-results/`. These are local verification artifacts rather than repository fixtures. Tests assert that telemetry excludes raw redaction originals and onboarding capabilities, and that a separate browser cannot read another intake's telemetry.

The API returns 202 after the local database transaction and before Gemini/CRM completion. Observed live evaluation results and timing are recorded in the JSON report; they are illustrative, not a latency guarantee.

## Limits of this evidence

- Four AI examples are not a clinical evaluation, broad safety assessment, or proof of prompt-injection immunity.
- Regex/contextual scrubbing can miss identifiers in arbitrary text. Pseudonymization is not a regulatory determination of de-identification.
- Gmail, Gemini, n8n hosting, and HubSpot require separate contractual, retention, and operational review before any real patient deployment.
- The synthetic insurance tool does not verify coverage with an actual payer. Appointment inventory and clinician login are demonstrations.
- Application idempotency and Gmail sent-message checks reduce duplicates; external network boundaries do not provide exactly-once delivery.
- Dependency audit still reports upstream Next.js/Tailwind/Prisma advisories. The critical test-runner advisory was removed by updating Vitest/Vite. Major framework migrations require their own review before public production use.

Final browser verification completed at 15:05 Asia/Shanghai. All six browser scenarios passed (1.2 minutes). The Docker port-mapping origin check was fixed and regression-tested before this run; requests from the configured browser origin reach validation, while unrelated origins return 403. An unsigned live n8n webhook returns 401.

At 15:54 Asia/Shanghai, both live browser scenarios passed again (49.6 seconds) after updating the four original workflow IDs on port 5678 and switching the app to that instance. This covered Gemini and real HubSpot, clinician approval, booking, token replay rejection, emergency blocking, and unauthorized requests. All three webhook endpoints reject unsigned requests with 401. The four installed workflows match the repository's nodes, connections, and settings; all 36 unrelated workflows and 12 encrypted saved credentials match their pre-update records. The unused 5679 instance is stopped with its volume retained. The runbook documents the selected topology and its Compose overrides.

At 16:04 Asia/Shanghai, manual-test readiness was checked again. All six browser scenarios passed (40.4 seconds). The lifecycle test was then strengthened to wait for both the approval-stage HubSpot update and `PREVIEW_ONLY` notification before booking; that check passed again (20.4 seconds). The final case reached `ONBOARDED` in both the vault and CRM, with its token burned and encrypted capability cleared. App/n8n health checks returned 200, integration secrets matched, simulation was disabled, and all three app webhook URLs pointed to port 5678. Email remains preview-only for manual testing; the prior separate Gmail self-test is the evidence for actual email delivery. See the [manual walkthrough](MANUAL_TESTING.md).

## Architecture learning guide — 2026-10-17

The [interactive architecture field guide](architecture-explorer.html) was reviewed against the current source. Its historical test results above are dated 16 October. At 11:23 Asia/Shanghai on 17 October, Docker's engine was unavailable and the app on 3005 and n8n on 5678 were unreachable; no new live AI/CRM/email execution is claimed for this guide work.

The self-contained HTML embeds its fonts, licenses, styles, scripts, and synthetic examples. Browser verification passed for all eight component selections, four walkthrough scenarios, five data destinations, five database tables, all six quiz answers and reset/incorrect feedback, checklist persistence, keyboard selection, and all six print sections. All six views were checked at widths 390, 768, 1280, 1440, and 1920 (30 layout checks). There were zero page errors and zero external requests with HTTP(S) blocked. Desktop/mobile screenshots are in ignored `test-results/architecture-*.png`.

The supporting graph has 339 nodes and 621 relationships, with an [audit report](../graphify-out/GRAPH_REPORT.md). It separates extracted and inferred relationships and records current implementation gaps. No application code, credentials, patient data, or workflows were changed. A temporary loopback preview on port 8787 serves only explicitly allowlisted guide/reference files; `.env` and `.runtime` requests return 404 and POST returns 405. The HTML also works directly from disk without that preview or Docker.

At 11:38 Asia/Shanghai, Docker and the selected services were started at the user's request. The app returned HTTP 200, n8n's readiness endpoint returned HTTP 200, PostgreSQL accepted connections, the app's database query succeeded, and the outbox worker was enabled. The three AegisFlow webhooks returned the expected 401 for unsigned requests. The architecture guide's runtime snapshot was refreshed; the full AI/CRM browser suite was not rerun for this service-start operation.

## Publication checks — 2026-10-17

Before committing the accumulated changes, `npm test` passed all 11 unit/security checks, `npm run test:integration` passed all 12 checks against the isolated `aegis_test` database, and `npm run lint` passed TypeScript validation. The prior live browser evidence remains dated 16 October; no new email was sent for publication. A text-file scan checked for known local credential values and common provider-token patterns without printing credential values; no credential findings remained. Environment files, credential exports, browser evidence, and generated graph bookkeeping remain ignored. The bundled graph library retains its MIT license notice, and the local fonts retain their OFL licenses.
