# ADR-001: Zero-PHI HubSpot Pseudonymization

- **Status:** Accepted
- **Context:** The CRM should not receive direct patient identifiers. Compliance depends on data use, provider agreements, and operational controls; pseudonymization alone does not establish it.
- **Decision (amended with explicit user approval on 2026-10-16):** Implement **Strict Pseudonymization** for all HubSpot records. HubSpot rejects the original `.internal` email domain, so Contacts use `email: <patient_uuid>@vault.example.com` and `firstname: Patient_<short_uuid>`. The full UUID prevents collisions in the contact upsert key. `example.com` is reserved for examples; CRM aliases are never notification recipients. When n8n requests a notification, it sends only a signed patient UUID to Next.js (`POST /api/internal/notify`), which decrypts the actual address in memory and dispatches through Gmail. The user explicitly selected Gmail instead of Resend. Portfolio mode permits delivery only to a configured test inbox and otherwise reports `PREVIEW_ONLY`.
- **Consequences:** 
  - *(+)* HubSpot receives pseudonymous identity and a protected vault link. The notification provider receives the actual recipient and invitation; n8n/Gemini receive scrubbed symptoms. These boundaries reduce exposure without guaranteeing de-identification or compliance.
  - *(-)* Marketing/sales teams viewing HubSpot cannot see real names inside HubSpot UI; they must click the `vault_review_url` property to resolve identity inside the RBAC-protected Next.js Vault.
