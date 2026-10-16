# ADR-004: Outbox State & n8n Dead-Letter Queue (DLQ) Recovery

- **Status:** Accepted
- **Context:** Because intake dispatch to n8n is asynchronous (`ADR-003`), network drops between Next.js and n8n or LLM/CRM outages inside n8n could leave `PatientVault` rows stuck in `SCRUBBED_DISPATCHED` indefinitely.
- **Decision:** Implement a two-sided failure recovery loop:
  1. **Next.js Outbox State:** If the initial `fetch()` to the n8n webhook fails or times out (>3s), Next.js marks `status = WEBHOOK_RETRY_PENDING` and exposes a "Retry Dispatch" button in the X-Ray UI.
  2. **n8n Global Error Callback (`error-dlq.json`):** Attach an n8n `Error Trigger` workflow to all main workflows. If an execution fails after node-level retries, `error-dlq` sends a signed POST to `/api/webhooks/n8n-callback` with `status = TRIAGE_FAILED_MANUAL_REVIEW` and the sanitized error code.
- **Consequences:**
  - *(+)* Zero silent failures; UI polling terminates cleanly on error and routes the patient directly to manual clinician triage.
  - *(-)* Every n8n workflow must pass `patient_uuid` in execution metadata/static data so the Error Trigger knows which patient failed.
