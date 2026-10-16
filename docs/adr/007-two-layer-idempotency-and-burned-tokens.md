# ADR-007: Two-Layer Idempotency & Single-Use Burned Onboarding Tokens

- **Status:** Accepted
- **Context:** Rapid retries or double-clicks can spawn duplicate CRM deals, while unexpired static onboarding URLs create persistent token replay vulnerabilities.
- **Decision:**
  1. **Two-Layer Idempotency:** Next.js enforces a unique `WebhookIdempotency` key per submission (`sha256(emailHash + YYYY-MM-DD + workflow_stage)`), and n8n utilizes HubSpot upserts by pseudonymous email (`<short_uuid>@vault.aegisflow.internal`) alongside open-deal deduplication checks.
  2. **Burned Capability Tokens:** Onboarding tokens are generated as random 32-byte strings, stored strictly as SHA-256 hashes with a 48h expiration, and marked `tokenUsedAt = now()` upon successful appointment booking to permanently invalidate the link.
  3. **Live Portfolio Hosting & Fallback:** Provide `docker-compose.yml` for local evaluation plus a cloud-hosted n8n instance paired with a `DEMO_SIMULATE_N8N_IF_SLEEPING=true` fallback mode so cold starts never break recruiter demos.
- **Consequences:**
  - *(+)* Complete protection against duplicate CRM lead creation, stale token replay attacks, and container sleep downtime during demos.
