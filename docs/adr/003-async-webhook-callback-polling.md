# ADR-003: Asynchronous Webhook Dispatch with Callback Status Polling

- **Status:** Accepted
- **Context:** Synchronous HTTP calls from Next.js through n8n (LLM Agent + Tool Calling + HubSpot API) take 4–8 seconds and risk timeout failures.
- **Decision:** Next.js `POST /api/intake` persists the encrypted Vault record, fires the n8n webhook asynchronously, and returns `202 Accepted` immediately. The frontend X-Ray Inspector polls `GET /api/intake/[id]/telemetry` every 1,000ms until n8n posts the final triage + HubSpot state back to `POST /api/webhooks/n8n-callback`.
- **Consequences:**
  - *(+)* Instant UI feedback (<150ms response); resilient to LLM latency spikes.
  - *(-)* Requires a `status` state machine on `PatientVault` (`SCRUBBED_DISPATCHED` -> `AI_TRIAGED` -> `CRM_SYNCED` -> `FAILED`).
