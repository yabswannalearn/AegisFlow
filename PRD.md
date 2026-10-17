# Product Requirements Document (PRD)

- **Project Name:** AegisFlow — Privacy-Focused AI Intake & Onboarding Portfolio Demo
> Implementation amendment (2026-10-16): Gemini replaces the original model, Gmail replaces Resend, ADR-001 uses the full UUID at vault.example.com, and ADR-007 permits temporary encrypted token retention. See README.md and docs/VERIFICATION.md for implemented behavior and verification limits. Insurance, clinician login, consent text, and slots are synthetic demonstrations.

- **Specification ID:** `AF-HIPAA-03 // REV 3.0 (MASTER — POST-GRILL LOCKED)`
- **Architecture Pattern:** Hybrid Full-Stack Security Gateway (Next.js App Router BFF) + Stateless Workflow Orchestration (Self-Hosted Dockerized n8n)
- **Regulatory Scope:** US HIPAA (PHI Privacy & Security Rules), TCPA (Telemarketing/SMS Opt-In), Telehealth Informed Consent & Notice of Privacy Practices (NPP)
- **Target Engineering Roles:** Software Engineer (Full-Stack/Backend), Applied AI Engineer (API/Agents), Automation Specialist (n8n/CRM)

---

## 1. Executive Summary & Architectural Problem

This synthetic portfolio project explores reducing direct identifier exposure across an AI routing and CRM workflow. Encryption and pseudonymization demonstrate technical controls; they do not establish regulatory compliance, a provider retention policy, or clinical safety. No real patient use is authorized by this specification.

**AegisFlow** solves this via a strict zero-trust, split-responsibility architecture:

1. **Next.js Client & Server BFF (The HIPAA Vault):** Acts as the deterministic security boundary. Handles patient intake, TCPA/HIPAA consent logging, `AES-256-GCM` field-level envelope encryption in PostgreSQL, contextual known-entity + 6-pass regex PII scrubbing, append-only immutable audit logging, frictionless demo Clinician RBAC (`jose` JWT), and blind email/SMS notification dispatch.
2. **Self-Hosted n8n Engine (Stateless Orchestrator):** Configured with zero execution payload retention (`EXECUTIONS_DATA_SAVE_ON_SUCCESS=none`). Receives scrubbed, pseudonymous payloads and pseudonymous CRM aliases (`Patient_<short_uuid>`) via `HMAC-SHA256` signed webhooks. Executes an XML-sandboxed AI Triage Agent with tool-calling, syncs HubSpot CRM pipelines using Vault reference URLs, handles Dead-Letter Queue (DLQ) failure callbacks, and orchestrates closed-loop patient onboarding.

---

## 2. End-to-End 5-Stage Closed-Loop System Topology

```mermaid
flowchart LR
    subgraph S1["1. Intake Portal (Next.js)"]
        A["/intake UI & BFF"] --> B["AES-256-GCM Vault + Consent & Audit Log"]
        B --> C["Contextual + 6-Pass PII Scrubber"]
    end

    subgraph S2["2. Stateless AI Triage (n8n #1)"]
        D["HMAC Verify + Idempotency"] --> E["XML-Sandboxed AI Agent + Tools"]
        E --> F["HubSpot Upsert (Pseudonymous Alias)"]
    end

    subgraph S3["3. Clinician HITL Vault (Next.js -> n8n #2)"]
        G["/admin/vault/[id] (RBAC + Audit)"] --> H["48h SHA-256 Capability Token"]
        H --> I["n8n #2 -> Blind Notify (/api/internal/notify)"]
    end

    subgraph S4["4. Patient Onboarding (Next.js)"]
        J["/onboarding/[token]"] --> K["KYC Card + Telehealth NPP E-Sign"]
        K --> L["Specialist Slot Booking + Burn Token"]
    end

    subgraph S5["5. Closed-Won Sync (n8n #3)"]
        M["HubSpot Deal: Closed Won"] --> N["Contact: Customer + Slack Alert"]
    end

    C -->|"Async HMAC Webhook (202 Accepted)"| D
    F -->|"Callback POST"| G
    I -->|"Magic Link Email/SMS"| J
    L -->|"Signed Webhook"| M
```

| Stage | Actor | Surface | System Action | HubSpot CRM State |
| :--- | :--- | :--- | :--- | :--- |
| **1. Lead Gen & Intake** | Patient | Next.js (`/intake`) | Validates input, logs HIPAA/TCPA consent, encrypts raw PHI (`AES-256-GCM`), scrubs PII, returns `202 Accepted`, dispatches async signed webhook to n8n #1. | — |
| **2. AI Triage & Routing** | AI Agent | n8n Workflow #1 (`triage-agent.json`) | Verifies HMAC, runs XML-sandboxed AI Agent + Insurance & Routing HTTP Tools, upserts pseudonymous HubSpot Contact & Deal, posts triage callback to Next.js. | Contact: `lead` (`Patient_<short_uuid>`)<br>Deal: `AI Triaged - Pending Review` |
| **3. HITL Clinician Review** | Clinician | Next.js (`/admin/vault/[id]`) $\rightarrow$ n8n #2 | Verifies RBAC JWT (or 1-click Demo Clinician session), logs `PHI_DECRYPTED_VIEW`, decrypts notes, generates 48h hashed token, triggers n8n #2 + blind notification. | Deal: `Approved - Onboarding Sent` |
| **4. Patient Onboarding** | Patient | Next.js (`/onboarding/[token]`) | Validates single-use token, confirms KYC ID/insurance card, captures Telehealth NPP e-signature, books specialist slot, burns token (`tokenUsedAt`), triggers n8n #3. | — |
| **5. Closed-Won Customer** | System | n8n Workflow #3 (`onboarding-complete.json`) | Transitions HubSpot Deal to `Closed Won`, upgrades Contact to `customer`, writes `appointment_datetime`, fires clinic Slack/Discord alert. | Contact: `customer`<br>Deal: `Closed Won - Appointment Booked` |

---

## 3. Complete Technology Stack ($0 Portfolio Cost Architecture)

| Stack Layer | Technologies & Libraries | Core Engineering Responsibility | Cost Tier |
| :--- | :--- | :--- | :--- |
| **Frontend UI** | Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui | Patient Intake Portal, Clinician HITL Vault, 3-Step Onboarding Portal, and live "Developer X-Ray" split-screen telemetry inspector. | `$0 (OSS)` |
| **Backend Gateway (BFF)** | Next.js Server Actions & Route Handlers, Zod | Schema validation, contextual + regex PII scrubbing, envelope encryption, mock insurance eligibility API, blind notification endpoint, signed webhook dispatch. | `$0 (OSS)` |
| **Database & ORM** | PostgreSQL 16 (Docker / Neon) + Prisma / Drizzle ORM | Stores `AES-256-GCM` encrypted `PatientVault` rows, append-only `AuditLog` records (enforced via SQL trigger), `ConsentRecord` proofs, and `WebhookIdempotency` keys. | `$0 (Free/Local)` |
| **Security & Auth** | Native Node.js `crypto` + `jose` JWT (RBAC) | `AES-256-GCM` field encryption, `HMAC-SHA256` webhook signing, `SHA-256` email/token hashing, and Clinician RBAC with 1-click Demo Clinician session minting. | `$0 (Native)` |
| **Orchestration** | Self-Hosted n8n (Docker Compose + Cloud/Simulated Fallback) | Stateless webhook routing (`EXECUTIONS_DATA_SAVE_ON_SUCCESS=none`), AI Agent execution, tool calling, HubSpot CRM pipeline updates, and Dead-Letter Queue error handling. | `$0 (Self-Host)` |
| **AI & LLM Layer** | n8n AI Agent + Google Gemini `gemini-3.1-flash-lite` | XML-sandboxed anonymized symptom triage, Structured Output Parser (strict JSON schema), emergency `CRITICAL` short-circuit, and HTTP tool invocation. | `~$0.01 / 50 runs` |
| **CRM & Comms** | HubSpot private app (v3/v4 APIs), Gmail OAuth | Manages pseudonymous Contacts, Deals, custom Triage Pipeline stages, Vault pointer links, synthetic demo magic link emails, and clinic alerts. | `$0 (Sandbox)` |

---

## 4. Functional Requirements: Modules 1 to 5

### Module 1: Patient Lead Generation & Compliant Intake (`/intake`)
- **[FR-1.1] Multi-Part Intake Capture:** Captures Patient Demographics (First Name, Last Name, Email, Phone, DOB), Insurance Info (Payer Name, Member ID, Group Number), Clinical Symptoms (free text), and explicit checkboxes for **HIPAA Authorization** and **TCPA SMS Opt-In**.
- **[FR-1.2] Legal Consent & Audit Persistence:** Route Handler / Server Action validates input via Zod, records client IP, User-Agent, UTC timestamp, and policy version in `ConsentRecord`, and writes an immutable `AuditLog` (`ACTION: INTAKE_SUBMITTED`).
- **[FR-1.3] Envelope Encryption & Contextual Scrubbing:** Raw PII and clinical notes are encrypted with `AES-256-GCM` before saving to `PatientVault`. The server runs `scrubSymptoms()` (combining Known-Entity tokenization of submitted `firstName`, `lastName`, `email`, `phone`, `memberId` with a 6-pass regex pipeline).
- **[FR-1.4] Asynchronous Outbox Dispatch (`ADR-001`, `ADR-003`, `ADR-004`):** Generates a deterministic `idempotency_key`, sets `PatientVault.status = SCRUBBED_DISPATCHED`, and dispatches an `HMAC-SHA256` signed webhook to n8n asynchronously while immediately returning `HTTP 202 Accepted` to the browser. If the initial fetch to n8n fails or times out (`>3s`), sets `status = WEBHOOK_RETRY_PENDING` (or triggers the simulated fallback if `DEMO_SIMULATE_N8N_IF_SLEEPING=true`).

```json
// POST https://n8n.internal/webhook/aegis-triage
// Headers: x-aegis-signature: <hmac_hex>, x-aegis-timestamp: 1792111082
{
  "idempotency_key": "sha256_8f9d2a1b...",
  "patient_uuid": "99481a7b-3c2d-4e9f-8a1b-772190c8e112",
  "crm_alias": {
    "first_name": "Patient_99481a",
    "email": "99481a00-1234-4abc-9def-000000000000@vault.example.com"
  },
  "insurance_provider": "Aetna_PPO",
  "scrubbed_symptoms": "Patient [REDACTED_NAME] (DOB: [REDACTED_DATE]) reports 4 days of chest tightness...",
  "vault_review_url": "https://aegisflow.demo/admin/vault/99481a7b-3c2d-4e9f-8a1b-772190c8e112"
}
```

### Module 2: Stateless AI Triage & Zero-PHI HubSpot Sync (n8n Workflow #1)
- **[FR-2.1] Cryptographic Verification & Two-Layer Idempotency (`ADR-007`):** n8n verifies the `HMAC-SHA256` signature and ±300s timestamp window.
- **[FR-2.2] XML-Sandboxed AI Triage Agent with Tool Calling (`ADR-005`):** The n8n AI Agent wraps `scrubbed_symptoms` inside `<untrusted_symptom_text>` XML tags (instructing the LLM to treat contents strictly as data, never imperative commands) and invokes two bound HTTP tools:
  1. `check_insurance_eligibility` (`GET /api/mock/insurance?payer=...`)
  2. `fetch_clinical_routing_rules` (`GET /api/mock/routing-rules`)
- **[FR-2.3] Structured Output Enforcement & Callback:** The Agent enforces a strict JSON Schema Output Parser (and Next.js re-validates via Zod on callback `POST /api/webhooks/n8n-callback`):

```json
{
  "urgency_level": "HIGH",
  "recommended_specialty": "Cardiology",
  "triage_rationale_redacted": "Acute chest tightness lasting >72h warrants priority cardiac evaluation.",
  "insurance_verified": true,
  "copay_estimate_usd": 35,
  "suggested_onboarding_track": "FastTrack"
}
```

- **[FR-2.4] Emergency Clinical Short-Circuit (`ADR-005`):** If `urgency_level === "CRITICAL"`, n8n branches immediately: sets HubSpot Deal priority to `HIGH`, fires an instant `[RED ALERT]` Slack/Discord webhook, and updates the callback status so the patient UI displays an emergency `911 / Emergency Care` banner instead of self-scheduling onboarding.
- **[FR-2.5] Zero-PHI Pseudonymous HubSpot Sync (`ADR-001`, `ADR-007`):** n8n upserts the HubSpot Contact using the pseudonymous email (`99481a00-1234-4abc-9def-000000000000@vault.example.com`), deduplicates open Deals for `patient_uuid`, and creates/updates the Deal in the **"Patient Intake Pipeline"** (Stage: `AI Triaged - Pending Clinician Review`) with `vault_review_url`.

### Module 3: Clinician HITL Vault & Blind Notification Dispatch (`/admin/vault/[id]` $\leftrightarrow$ n8n #2)
- **[FR-3.1] RBAC Middleware & One-Click Demo Session (`ADR-006`):** `/admin/vault/[id]` is protected by `jose` JWT cookie middleware. Includes a **"Sign in as Demo Clinician (Dr. Sarah Chen — Cardiology)"** one-click action that mints a real 1-hour signed JWT (`sub: "dr_chen_demo"`, `role: "CLINICIAN"`) for zero-friction portfolio evaluation.
- **[FR-3.2] Audited Decryption:** Loading the patient record inserts an append-only `AuditLog` row (`actorId: "dr_chen_demo"`, `action: PHI_DECRYPTED_VIEW`) and decrypts the raw PII, clinical notes, and AI triage card on the server.
- **[FR-3.3] One-Click Approval & Hashed Capability Token (`ADR-007`):** Clicking **"Approve & Start Onboarding"** generates a random 32-byte raw `token`, stores `onboardingTokenHash = sha256(token)`, `tokenExpiresAt = now + 48h`, and a temporary AES-GCM encrypted token until delivery, expiry, or booking (user-approved ADR-007 amendment) in `PatientVault`, and triggers **n8n Workflow #2**.
- **[FR-3.4] Blind Notification Dispatch (`ADR-001`):** n8n Workflow #2 updates the HubSpot Deal stage to `Approved - Onboarding Sent` and calls Next.js `POST /api/internal/notify` (signed with HMAC). Next.js decrypts the patient's email/phone in memory and sends the synthetic demo magic link (`https://aegisflow.demo/onboarding/{raw_token}`) via Gmail so plaintext contact info never enters n8n or HubSpot.

### Module 4: 3-Step Patient Onboarding Portal (`/onboarding/[token]` $\leftrightarrow$ n8n Workflow #3)
- **[FR-4.1] Single-Use Token Validation (`ADR-007`):** Navigating to `/onboarding/[token]` hashes the URL token with `SHA-256` and verifies that `onboardingTokenHash` exists, `tokenExpiresAt > now()`, and `tokenUsedAt IS NULL`. If `tokenUsedAt` is already set, renders a read-only *"Onboarding Completed — Appointment Confirmed"* receipt.
- **[FR-4.2] Step 1 — KYC Identity & Insurance Card Confirmation:** Patient uploads a photo ID and insurance card (includes a *"Populate Demo Insurance Card"* button for recruiters). Next.js encrypts the document metadata and logs `ACTION: KYC_VERIFIED`.
- **[FR-4.3] Step 2 — Telehealth Informed Consent & NPP E-Signature:** Captures the patient's typed legal signature acknowledging the **Notice of Privacy Practices (NPP)** and Consent to Telehealth Treatment, storing the signature hash and IP in `ConsentRecord`.
- **[FR-4.4] Step 3 — Specialist Slot Booking & Token Burn:** Displays available time slots for the approved specialty. Clicking **"Confirm Appointment"** sets `tokenUsedAt = now()`, updates `PatientVault.status = ONBOARDED`, logs `ACTION: ONBOARDING_COMPLETED`, and triggers **n8n Workflow #3**.
- **[FR-4.5] HubSpot Closed-Won & Customer Lifecycle Upgrade:** n8n Workflow #3 transitions the HubSpot Deal stage to **`Closed Won - Appointment Booked`**, upgrades the HubSpot Contact `lifecyclestage` from `lead` to **`customer`**, writes the `appointment_datetime` property, and posts a confirmation alert to the clinic's Slack/Discord channel.

### Module 5: "Developer X-Ray Mode" Live Telemetry UI (Portfolio Showcase Feature)
- **[FR-5.1] Real-Time 4-Stage Split-Screen Inspector (`ADR-003`):** Accessible via a persistent header toggle so technical interviewers can inspect the full backend pipeline without leaving the browser. Polls `GET /api/intake/[id]/telemetry` every 1,000ms to update four live telemetry cards:
  1. **Raw Browser Payload:** Highlights detected PII/PHI tokens in red prior to encryption/scrubbing.
  2. **PostgreSQL Vault Row:** Displays live `AES-256-GCM` ciphertext (`v1:iv:authTag:ciphertext`) and the append-only `AuditLog` stream.
  3. **Scrubbed n8n Webhook Inspector:** Displays the exact anonymized JSON, pseudonymous CRM alias, and `HMAC-SHA256` signature sent to n8n (with a Retry button if `WEBHOOK_RETRY_PENDING`).
  4. **AI Agent & HubSpot Deal State:** Shows structured triage JSON, live CRM stage transitions, and a 1-click **"Open Clinician Vault as Dr. Sarah Chen"** button.

---

## 5. Lightweight Security Core (~150 LOC Specification)

### 5.1 Field-Level Envelope Encryption (`src/lib/crypto.ts`)
Uses native Node.js `crypto` with `aes-256-gcm` and a 32-byte master key (`PHI_ENCRYPTION_KEY`). Every encrypted field generates a fresh 12-byte random IV and 16-byte authentication tag, stored in canonical format:
`v1:{iv_hex}:{authTag_hex}:{ciphertext_hex}`

### 5.2 Bidirectional Webhook Signing (`src/lib/hmac.ts`)
Signs all Next.js $\leftrightarrow$ n8n payloads using `HMAC-SHA256(AEGIS_WEBHOOK_SECRET, "${timestamp}.${rawBody}")` via `crypto.timingSafeEqual`. Requests with a timestamp drift exceeding `±300 seconds` are rejected (`HTTP 401`) to prevent replay attacks.

### 5.3 Contextual Known-Entity + 6-Pass Regex Scrubber (`src/lib/scrubber.ts`)

| Scrubber Pass | Target PII / PHI Entity | Detection Pattern / Logic | Replacement Token |
| :--- | :--- | :--- | :--- |
| **Pass 0 (Contextual)** | Known Patient Entities (`ADR-002`) | Case-insensitive exact/boundary match against submitted `firstName`, `lastName`, `email`, `phone`, `memberId` | `[REDACTED_ENTITY]` |
| **Pass 1 (Regex)** | Honorifics & Self-Identifiers | `\b(?:Mr\.|Mrs\.|Ms\.|Dr\.|my name is)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b` | `[REDACTED_NAME]` |
| **Pass 2 (Regex)** | US Social Security Number | `\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b` | `[REDACTED_SSN]` |
| **Pass 3 (Regex)** | Phone Numbers (US/Intl) | `(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b` | `[REDACTED_PHONE]` |
| **Pass 4 (Regex)** | Email Addresses | `[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}` | `[REDACTED_EMAIL]` |
| **Pass 5 (Regex)** | Dates & Date of Birth | `\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b` | `[REDACTED_DATE]` |
| **Pass 6 (Regex)** | Street Addresses & Member IDs | `\b\d{1,5}\s+[A-Za-z0-9\s]{2,20}\s+(?:St|Ave|Rd|Blvd|Ln|Dr)\b` + `\b[A-Z]{3}\d{6,10}\b` | `[REDACTED_ADDRESS]` / `[REDACTED_MEMBER_ID]` |

---

## 6. Node-by-Node n8n Workflow Blueprints (Git-Tracked JSONs)

All four n8n workflows are exported as declarative JSON files inside `/n8n/workflows/` so code reviewers can inspect orchestration logic alongside the Next.js codebase.

### 6.1 Primary Triage & Lead Routing Workflow (`triage-agent.json`)

| Node Order | n8n Node Type | Execution Logic & Configuration |
| :--- | :--- | :--- |
| **Node 01** | `Webhook (POST)` | Listens on `/webhook/aegis-triage`. Stores `patient_uuid` in workflow static/execution metadata for DLQ tracking. |
| **Node 02** | `Code (TypeScript)` | Computes `HMAC-SHA256` using `$env.AEGIS_WEBHOOK_SECRET`. Throws `401 Unauthorized` if signature mismatches or timestamp drift `>300s`. |
| **Node 03** | `AI Agent (Tools Agent)` | Connected to **Google Gemini Chat Model (`gemini-3.1-flash-lite`)** + **Structured Output Parser**. Wraps `scrubbed_symptoms` in `<untrusted_symptom_text>` tags. |
| **Node 04a/b** | `HTTP Request Tool` | Bound tools invoked dynamically by Node 03: queries `GET /api/mock/insurance?payer=...` and `GET /api/mock/routing-rules` on Next.js server. |
| **Node 05** | `IF / Switch (Emergency Check)` | Checks if `urgency_level === "CRITICAL"`. If true, triggers instant `[RED ALERT]` Slack/Discord webhook and sets emergency flag. |
| **Node 06** | `HubSpot (Contact Upsert)` | Upserts Contact via pseudonymous email (`<patient_uuid>@vault.example.com`); sets `firstname = Patient_<short_uuid>`, `lifecyclestage = lead`. |
| **Node 07** | `HubSpot (Deal Upsert)` | Deduplicates open Deals by `aegis_patient_uuid`, then creates/updates Deal in *Patient Intake Pipeline* (`Stage: AI Triaged`, `vault_review_url`). |
| **Node 08** | `HTTP Request (POST)` | Signs and dispatches AI triage JSON + `hubspotContactId` + `hubspotDealId` back to Next.js `POST /api/webhooks/n8n-callback`. |

### 6.2 Secondary & Reliability Workflows
- **Workflow #2: HITL Approval Dispatch (`onboarding-dispatch.json`):**
  - *Trigger:* Clinician clicks Approve in Vault.
  - *Nodes:* Webhook $\rightarrow$ HMAC Verify $\rightarrow$ HubSpot Deal Update (`Stage: Approved - Onboarding Sent`) $\rightarrow$ Signed POST to Next.js `/api/internal/notify` (which decrypts email/phone in memory and sends the magic link via Resend) $\rightarrow$ Next.js Audit Callback.
- **Workflow #3: Onboarding Completion (`onboarding-complete.json`):**
  - *Trigger:* Patient completes 3-step onboarding on `/onboarding/[token]`.
  - *Nodes:* Webhook $\rightarrow$ HMAC Verify $\rightarrow$ HubSpot Deal Update (`Stage: Closed Won - Appointment Booked`, `appointment_datetime`) $\rightarrow$ HubSpot Contact Update (`lifecyclestage: customer`) $\rightarrow$ Slack/Discord Clinic Notification.
- **Workflow #4: Global Dead-Letter Error Handler (`error-dlq.json`):**
  - *Trigger:* Global n8n `Error Trigger` node (`ADR-004`).
  - *Nodes:* Captures failed workflow ID, node name, `patient_uuid`, and sanitized error code (stripping payload bodies) $\rightarrow$ Posts alert to Slack Ops channel $\rightarrow$ Sends signed POST to Next.js `/api/webhooks/n8n-callback` with `status = TRIAGE_FAILED_MANUAL_REVIEW`.
- **Retry & Backoff Policy:** All external HTTP and HubSpot nodes in n8n are configured with `Retry On Fail = true` (Max 3 tries, 2000ms exponential wait) paired with `WebhookIdempotency` keys.

---

## 7. HubSpot CRM Custom Property & Pipeline Specification

- **Deal Pipeline (`Patient Intake Pipeline`) Stages:**
  1. `AI Triaged - Pending Review`
  2. `Approved - Onboarding Sent`
  3. `Closed Won - Appointment Booked`
  4. `Closed Lost - Referred Out / Emergency`
- **Custom Contact Properties:**
  - `aegis_patient_uuid` (Single-line text, Unique identifier)
  - `hipaa_consent_verified` (Boolean)
- **Custom Deal Properties (Zero-PHI Policy):**
  - `aegis_patient_uuid` (Single-line text)
  - `vault_review_url` (URL pointer to Next.js Clinician Vault)
  - `ai_urgency_level` (Enum: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
  - `recommended_specialty` (Single-line text)
  - `onboarding_track` (Enum: `FastTrack`, `Standard`, `ManualReview`, `Emergency911`)
  - `appointment_datetime` (DateTime)

---

## 8. PostgreSQL Database Schema & Immutability Trigger

| Table Name | Columns & Data Types | Security & Compliance Purpose |
| :--- | :--- | :--- |
| `PatientVault` | `id` (UUID PK), `emailHash` (String Indexed), `encryptedPiiJson` (Text), `encryptedSymptoms` (Text), `encryptedKycJson` (Text Nullable), `scrubbedSymptoms` (Text), `aiTriageJson` (JSONB), `onboardingTokenHash` (String Unique Nullable), `tokenExpiresAt` (Timestamp Nullable), `tokenUsedAt` (Timestamp Nullable), `appointmentSlot` (Timestamp Nullable), `status` (Enum: `SCRUBBED_DISPATCHED`, `WEBHOOK_RETRY_PENDING`, `AI_TRIAGED`, `CRM_SYNCED`, `TRIAGE_FAILED_MANUAL_REVIEW`, `EMERGENCY_HALTED`, `APPROVED`, `ONBOARDED`), `hubspotContactId` (String Nullable), `hubspotDealId` (String Nullable), `createdAt`, `updatedAt` | Stores all PHI encrypted at rest via `AES-256-GCM`. Uses `emailHash` and `onboardingTokenHash` (`SHA-256`) with `tokenUsedAt` single-use burn for zero-plaintext lookups. |
| `ConsentRecord` | `id` (UUID PK), `patientId` (FK), `consentType` (Enum: `HIPAA_INTAKE`, `TCPA_SMS`, `TELEHEALTH_NPP`), `signatureText` (String), `ipAddress` (String), `userAgent` (String), `policyVersion` (String), `createdAt` | Provides non-repudiable legal proof of TCPA SMS opt-in and Telehealth NPP e-signature prior to communications or booking. |
| `AuditLog` | `id` (UUID PK), `actorId` (String), `actorRole` (Enum: `PATIENT`, `N8N_SYSTEM`, `CLINICIAN`), `patientId` (FK), `action` (Enum: `INTAKE_SUBMITTED`, `PII_SCRUBBED`, `AI_TRIAGED`, `TRIAGE_FAILED`, `PHI_DECRYPTED_VIEW`, `ONBOARDING_APPROVED`, `BLIND_NOTIFY_SENT`, `KYC_VERIFIED`, `ONBOARDING_COMPLETED`), `metadata` (JSONB), `ipAddress` (String), `createdAt` | Protected by PostgreSQL trigger preventing `UPDATE` or `DELETE`. Logs every creation, scrub, AI triage, decryption view, and approval. |
| `WebhookIdempotency` | `key` (String PK), `workflowName` (String), `status` (Enum: `PROCESSING`, `COMPLETED`, `FAILED`), `processedAt` (Timestamp) | Guarantees idempotent webhook execution across Next.js double-clicks and n8n retries (`ADR-007`). |

```sql
-- PostgreSQL Migration: Enforce Append-Only Immutability on HIPAA AuditLog Table
CREATE OR REPLACE FUNCTION prevent_audit_log_modification() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'HIPAA Compliance Violation: AuditLog table is strictly append-only. UPDATE and DELETE are prohibited.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_log_immutable
BEFORE UPDATE OR DELETE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
```

---

## 9. API Endpoint & Webhook Contract Inventory

| Method | Route / Endpoint | Auth Mechanism | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/intake` | Public + Rate Limit + Idempotency | Validates intake, logs consent, encrypts PHI, scrubs PII, fires n8n #1 async (`202 Accepted`). |
| `GET` | `/api/intake/[id]/telemetry` | Demo Inspector Session | Returns live 4-stage telemetry snapshot for the X-Ray UI split screen (`1s` polling). |
| `POST` | `/api/intake/[id]/retry` | Demo Inspector / Admin | Retries webhook dispatch if `status === WEBHOOK_RETRY_PENDING`. |
| `GET` | `/api/mock/insurance` | `x-aegis-tool-key` | Called by n8n AI Agent Tool to verify payer coverage & copay estimate. |
| `GET` | `/api/mock/routing-rules` | `x-aegis-tool-key` | Called by n8n AI Agent Tool to map clinical symptoms to specialist tracks. |
| `POST` | `/api/webhooks/n8n-callback` | `x-aegis-signature` (HMAC) | Receives structured AI triage JSON, HubSpot IDs, or DLQ failure states (`error-dlq`) from n8n. |
| `POST` | `/api/auth/demo-session` | Public Demo Action | Mints a 1-hour `jose` JWT cookie (`sub: "dr_chen_demo"`, `role: "CLINICIAN"`) for 1-click evaluation. |
| `POST` | `/api/vault/[id]/approve` | Clinician RBAC JWT | Generates 48h SHA-256 onboarding token, logs approval, fires n8n #2. |
| `POST` | `/api/internal/notify` | `x-aegis-signature` (HMAC) | Blind Notification Dispatch: decrypts patient email/phone in memory and sends magic link via Resend. |
| `POST` | `/api/onboarding/[token]/complete` | SHA-256 Single-Use Token | Saves KYC + NPP e-sign + slot booking, burns token (`tokenUsedAt = now()`), fires n8n #3. |

---

## 10. Security Threat Model (STRIDE Mitigation Matrix)

1. **Prompt Injection & PII Leakage to LLMs (Tampering / Information Disclosure):** Mitigated by running contextual known-entity + 6-pass regex redaction (`scrubber.ts`) on the Next.js server *before* n8n or OpenAI receives the text, isolating input in `<untrusted_symptom_text>` XML tags (`ADR-005`), and enforcing dual JSON Schema + Zod validation.
2. **Webhook Spoofing, Replay Attacks & Duplicate Deals (Spoofing / Elevation):** Mitigated via bidirectional `HMAC-SHA256` signature headers bound to a 300-second timestamp window and two-layer idempotency (`WebhookIdempotency` unique key + HubSpot pseudonymous email upsert).
3. **Third-Party CRM & Log Honeypots (Information Disclosure):** Mitigated by strict HubSpot pseudonymization (`<patient_uuid>@vault.example.com`), blind notification dispatch (`/api/internal/notify`), and configuring Dockerized n8n with `EXECUTIONS_DATA_SAVE_ON_SUCCESS=none`.
4. **Audit Log Tampering (Repudiation):** Mitigated by the PostgreSQL `BEFORE UPDATE OR DELETE` trigger on `"AuditLog"` that raises a database-level exception on any mutation attempt.
5. **Stale Onboarding Link Replay (Elevation of Privilege):** Mitigated by storing only `SHA-256(token)` with a 48-hour expiry and burning the token (`tokenUsedAt = now()`) upon completion (`ADR-007`).

---

## 11. Domain Glossary & Architecture Decision Records (ADRs)

Full standalone files are maintained in [`GLOSSARY.md`](file:///D:/vscode/Personal/AegisFlow/GLOSSARY.md) and [`docs/adr/`](file:///D:/vscode/Personal/AegisFlow/docs/adr/):

- **[ADR-001: Zero-PHI HubSpot Pseudonymization](file:///D:/vscode/Personal/AegisFlow/docs/adr/001-zero-phi-hubspot-pseudonymization.md):** HubSpot stores only `<patient_uuid>@vault.example.com` and `Patient_<short_uuid>`. Actual emails/SMS are sent via Next.js blind dispatch (`POST /api/internal/notify`).
- **[ADR-002: Contextual Known-Entity & Regex Scrubber](file:///D:/vscode/Personal/AegisFlow/docs/adr/002-contextual-known-entity-scrubber.md):** Combines dynamic matching of submitted form fields (`firstName`, `lastName`, `email`, `phone`, `memberId`) with a 6-pass regex pipeline for sub-5ms zero-dependency redaction.
- **[ADR-003: Asynchronous Webhook Dispatch with Callback Status Polling](file:///D:/vscode/Personal/AegisFlow/docs/adr/003-async-webhook-callback-polling.md):** `POST /api/intake` returns `202 Accepted` in `<150ms` while the X-Ray UI polls `/api/intake/[id]/telemetry` until n8n completes callback.
- **[ADR-004: Outbox State & n8n Dead-Letter Queue (DLQ) Recovery](file:///D:/vscode/Personal/AegisFlow/docs/adr/004-outbox-and-dlq-failure-recovery.md):** Handles network failures via `WEBHOOK_RETRY_PENDING` outbox state and catches mid-flight n8n failures via `error-dlq.json` callback (`TRIAGE_FAILED_MANUAL_REVIEW`).
- **[ADR-005: XML-Sandboxed AI Prompts & Emergency Clinical Short-Circuit](file:///D:/vscode/Personal/AegisFlow/docs/adr/005-xml-sandboxed-prompt-and-critical-short-circuit.md):** Isolates symptoms in `<untrusted_symptom_text>` tags, validates with Zod, and short-circuits `CRITICAL` urgency to an emergency 911 banner + `[RED ALERT]` webhook.
- **[ADR-006: Frictionless Demo RBAC Session Minting](file:///D:/vscode/Personal/AegisFlow/docs/adr/006-frictionless-demo-rbac-session.md):** Protects `/admin/vault/[id]` with real `jose` JWT RBAC middleware while providing a 1-click *"Sign in as Demo Clinician (Dr. Sarah Chen)"* button for recruiters.
- **[ADR-007: Two-Layer Idempotency & Single-Use Burned Onboarding Tokens](file:///D:/vscode/Personal/AegisFlow/docs/adr/007-two-layer-idempotency-and-burned-tokens.md):** Prevents duplicate HubSpot deals via DB idempotency keys + CRM upserts, burns onboarding tokens after use (`tokenUsedAt`), and includes a simulated n8n fallback (`DEMO_SIMULATE_N8N_IF_SLEEPING=true`) for 24/7 live portfolio reliability.

---

## 12. Monorepo Structure & Environment Configuration

```text
aegisflow/
├── docker-compose.yml       # Postgres 16 + Self-Hosted n8n (Zero-Retention config)
├── .env.example             # Documented security keys & fallback flags
├── GLOSSARY.md              # Domain Ubiquitous Language
├── PRD.md                   # Master Product Requirements Document
├── docs/
│   └── adr/                 # Architecture Decision Records (001 through 007)
├── prisma/
│   ├── schema.prisma        # PatientVault, ConsentRecord, AuditLog, WebhookIdempotency
│   └── migrations/          # Includes immutable AuditLog SQL trigger
├── n8n/
│   └── workflows/           # Git-tracked n8n JSON exports
│       ├── triage-agent.json
│       ├── onboarding-dispatch.json
│       ├── onboarding-complete.json
│       └── error-dlq.json
└── src/
    ├── app/
    │   ├── intake/          # Module 1 Intake Portal + Module 5 X-Ray Split UI
    │   ├── admin/vault/[id] # Module 3 Clinician HITL Vault UI
    │   ├── onboarding/[tok] # Module 4 3-Step Patient Onboarding Portal
    │   └── api/             # Signed Webhooks, Blind Notify, Telemetry & Mock Tools
    └── lib/
        ├── crypto.ts        # AES-256-GCM encrypt/decrypt + SHA-256 hashing
        ├── hmac.ts          # Webhook signer & timing-safe verifier
        ├── scrubber.ts      # Contextual known-entity + 6-pass regex redaction
        ├── auth.ts          # jose JWT RBAC middleware & Demo Clinician session minting
        └── audit.ts         # Append-only AuditLog service
```

```ini
# --- Next.js Security & Database (.env.example) ---
DATABASE_URL="postgresql://aegis:pass@localhost:5432/aegis"
PHI_ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
AEGIS_WEBHOOK_SECRET="shared-hmac-sha256-signing-secret"
AEGIS_TOOL_API_KEY="internal-n8n-tool-auth-token"
JWT_RBAC_SECRET="clinician-rbac-jose-jwt-secret"
DEMO_SIMULATE_N8N_IF_SLEEPING="true"

# --- Self-Hosted n8n Docker Config ---
N8N_ENCRYPTION_KEY="strict-n8n-credential-encryption-key"
EXECUTIONS_DATA_SAVE_ON_SUCCESS="none"
EXECUTIONS_DATA_SAVE_ON_ERROR="all"
EXECUTIONS_DATA_PRUNE="true"
EXECUTIONS_DATA_MAX_AGE="24"

# --- External Integrations ---
OPENAI_API_KEY="sk-proj-..."
HUBSPOT_PRIVATE_APP_TOKEN="pat-na1-..."
RESEND_API_KEY="re_..."
SLACK_CLINIC_WEBHOOK_URL="https://hooks.slack.com/..."
```

---

## 13. 14-Day Engineering Sprint Roadmap

| Sprint Phase | Timeline | Milestones & Verification Deliverable |
| :--- | :--- | :--- |
| **Phase 1: Core Security & DB** | Days 1 – 3 | Boot Docker Compose (Postgres + n8n). Implement Prisma schema, `AuditLog` immutability trigger, `crypto.ts`, `hmac.ts`, `scrubber.ts`, and `auth.ts` with Vitest unit tests. |
| **Phase 2: Intake & AI Triage (#1)** | Days 4 – 6 | Build `/intake` UI, async outbox dispatch, and Mock Insurance/Routing APIs. Build **n8n Workflow #1** (HMAC check, XML-sandboxed AI Agent + Tools, Emergency short-circuit, pseudonymous HubSpot upsert, callback) + Simulated fallback. |
| **Phase 3: HITL Vault & Blind Notify (#2)** | Days 7 – 9 | Build `/admin/vault/[id]` with `jose` RBAC, 1-click Demo Clinician login, audited decryption, 48h token generator, and `/api/internal/notify`. Build **n8n Workflow #2**. |
| **Phase 4: Onboarding Portal (#3)** | Days 10 – 12 | Build 3-step `/onboarding/[token]` portal (KYC card, Telehealth NPP e-sign, slot booking, single-use token burn). Build **n8n Workflow #3** (Deal $\rightarrow$ `Closed Won`, Contact $\rightarrow$ `customer`, Slack alert). |
| **Phase 5: X-Ray UI, DLQ & Polish** | Days 13 – 14 | Build split-screen "Developer X-Ray" telemetry UI, configure **n8n Workflow #4** (`error-dlq.json`), export JSON workflows to `/n8n/workflows/`, and run E2E verification suite. |

---

## 14. Acceptance Criteria & Automated Verification Suite

- **Gate 1: Zero-PII Leak Unit Test (`Vitest`):** Passes 25 synthetic clinical paragraphs containing self-referential names, honorifics, SSNs, phones, emails, and DOBs through `scrubSymptoms()` and asserts `0%` raw token survival.
- **Gate 2: Cryptographic & Replay Tamper Test (`Vitest`):** Verifies that modifying 1 byte of an `AES-256-GCM` ciphertext throws an authentication tag error, and sending an unsigned or stale (`>300s`) webhook returns `HTTP 401`.
- **Gate 3: Audit Immutability Check (`Integration`):** Executes `DELETE FROM "AuditLog"` and `UPDATE "AuditLog"` against PostgreSQL and asserts the database raises the custom HIPAA compliance exception.
- **Gate 4: Closed-Loop E2E Lifecycle & Token Burn (`Playwright`):** Completes intake $\rightarrow$ AI triage $\rightarrow$ 1-click Demo Clinician approval $\rightarrow$ Patient onboarding, verifies HubSpot Deal equals `Closed Won` and Contact equals `customer`, and confirms refreshing `/onboarding/[token]` shows the burned read-only receipt.
