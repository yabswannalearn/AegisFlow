# ADR-007: Two-Layer Idempotency & Single-Use Burned Onboarding Tokens

- **Status:** Accepted
- **Context:** Rapid retries or double-clicks can spawn duplicate CRM deals, while unexpired static onboarding URLs create persistent token replay vulnerabilities.
- **Decision (delivery amendment explicitly approved by the user on 2026-10-16):**
  1. **Two-Layer Idempotency:** Next.js enforces a unique `WebhookIdempotency` key scoped to the submission, day, and demo browser where applicable. The CRM gateway upserts by full-UUID pseudonymous email (`<patient_uuid>@vault.example.com`) and a unique `aegis_patient_uuid` deal property, as approved in ADR-001. Booking uses a database row lock to serialize token consumption.
  2. **Burned Capability Tokens:** Onboarding tokens are generated as random 32-byte strings. The SHA-256 hash is the permanent lookup key, with a 48-hour expiration and an atomic `tokenUsedAt` burn upon booking. To make delayed blind Gmail delivery retryable, an additional AES-256-GCM encrypted copy is retained temporarily inside the Patient Vault. It is cleared after confirmed email delivery, token expiry, or booking. The plaintext capability is never returned by telemetry or transmitted to n8n. Public demo mode previews invitations until a test inbox is configured.
  3. **Live Portfolio Hosting & Fallback:** Provide `docker-compose.yml` for local evaluation plus a cloud-hosted n8n instance paired with a `DEMO_SIMULATE_N8N_IF_SLEEPING=true` fallback mode so cold starts never break recruiter demos.
- **Consequences:**
  - *(+)* Unique upsert keys prevent duplicate CRM creation on retries; atomic consumption prevents a second booking. Durable dispatch recovers after downtime, while explicit simulation can keep synthetic demonstrations usable. External delivery remains at-least-once.
