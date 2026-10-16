# ADR-001: Zero-PHI HubSpot Pseudonymization

- **Status:** Accepted
- **Context:** Under HIPAA, sending a patient's plaintext Name + Email to a standard HubSpot CRM instance creates a compliance violation because it links an identifiable person to a healthcare intake pipeline without a $3,600/mo HubSpot Enterprise BAA.
- **Decision:** Implement **Strict Pseudonymization** for all HubSpot records. HubSpot Contacts are created with `email: <short_uuid>@vault.aegisflow.internal` and `firstname: Patient_<short_uuid>`. When n8n needs to trigger an email or SMS during onboarding, n8n sends a signed request to Next.js (`POST /api/internal/notify`), which decrypts the patient's email/phone in memory and dispatches via Resend/Twilio.
- **Consequences:** 
  - *(+)* Zero plaintext PII/PHI ever leaves our Postgres database; free HubSpot Developer Sandbox remains 100% compliant by design.
  - *(-)* Marketing/sales teams viewing HubSpot cannot see real names inside HubSpot UI; they must click the `vault_review_url` property to resolve identity inside the RBAC-protected Next.js Vault.
