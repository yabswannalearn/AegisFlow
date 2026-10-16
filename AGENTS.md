# AGENTS.md — AegisFlow Agent Operating Instructions

Welcome to the **AegisFlow** repository (HIPAA-Compliant AI Patient Intake, Triage & HubSpot Onboarding Engine). Any AI coding agent or subagent working in this repository **MUST** follow the rules and workflows defined below.

---

## 1. Mandatory Source-of-Truth Reading

Before planning, writing, or modifying any code, consult these project documents:
1. **[PROGRESS.md](file:///D:/vscode/Personal/AegisFlow/PROGRESS.md)** — Live Kanban board tracking current tasks (`Backlog`, `In Progress`, `In Review / Testing`, `Done`).
2. **[IMPLEMENTATION_PLAN.md](file:///D:/vscode/Personal/AegisFlow/IMPLEMENTATION_PLAN.md)** — Step-by-step 6-phase execution plan and verification gates.
3. **[PRD.md](file:///D:/vscode/Personal/AegisFlow/PRD.md)** — Master specification covering all 5 functional modules, database schema, security core, API endpoints, and n8n workflows.
4. **[GLOSSARY.md](file:///D:/vscode/Personal/AegisFlow/GLOSSARY.md)** — Ubiquitous domain terminology (PHI, Patient Vault, Pseudonymous CRM Alias, Contextual Scrubber, Blind Notification Dispatch, Dead-Letter Callback, Emergency Short-Circuit, One-Click Demo Session, Single-Use Burned Capability Token).
5. **[docs/adr/](file:///D:/vscode/Personal/AegisFlow/docs/adr/)** — Architecture Decision Records (`ADR-001` through `ADR-007`). Do not violate locked architectural decisions without explicit user approval.

---

## 2. Mandatory Kanban Board Protocol (`PROGRESS.md`)

**Every agent MUST keep [PROGRESS.md](file:///D:/vscode/Personal/AegisFlow/PROGRESS.md) synchronized in real time whenever a feature or task is started, updated, tested, or completed:**

1. **When Starting a Task:**
   - Move the task item from `📋 Backlog (Todo)` to `🚧 In Progress` in [PROGRESS.md](file:///D:/vscode/Personal/AegisFlow/PROGRESS.md).
   - Update the corresponding Phase status in the **Phase Summary** table to `🚧 In Progress`.
2. **When Implementing / Testing a Feature:**
   - Once the code for a task is written and undergoing unit/integration verification, move the item to `🧪 In Review / Testing` (or directly to `✅ Done` once verified).
3. **When Completing a Task or Feature:**
   - Check the box (`- [x] **[P#-##]** ...`) and move the item under the appropriate phase section in `✅ Done`.
   - Recalculate the percentage in the **Phase Summary** table at the top of [PROGRESS.md](file:///D:/vscode/Personal/AegisFlow/PROGRESS.md).
   - Append a concise entry to the **📝 Changelog / Activity Log** table at the bottom of [PROGRESS.md](file:///D:/vscode/Personal/AegisFlow/PROGRESS.md) with the timestamp, agent name, task ID(s), and a 1-line summary of what changed.
4. **Never Leave Stale State:**
   - Do not finish a turn after modifying features or completing a task without updating [PROGRESS.md](file:///D:/vscode/Personal/AegisFlow/PROGRESS.md).

---

## 3. Core Architectural & Security Guardrails

When implementing features, enforce these non-negotiable constraints from `ADR-001` through `ADR-007`:

- **Zero-PHI Outside the Vault (`ADR-001`):** Raw PII/PHI (`firstName`, `lastName`, `email`, `phone`, `dob`, `memberId`, `rawSymptoms`) must be encrypted with `AES-256-GCM` (`v1:iv:authTag:ciphertext`) before saving to `PatientVault`. Never send plaintext patient contact details to n8n or HubSpot; always use pseudonymous CRM aliases (`Patient_<short_uuid>`, `<short_uuid>@vault.aegisflow.internal`) and `/api/internal/notify` for blind notification dispatch.
- **Contextual + 6-Pass Regex Scrubbing (`ADR-002`):** Always pass known intake entities (`firstName`, `lastName`, `email`, `phone`, `memberId`) into `scrubSymptoms()` alongside the 6 regex passes before dispatching symptom text to n8n/LLMs.
- **Async Webhook Dispatch & Outbox Recovery (`ADR-003`, `ADR-004`):** `POST /api/intake` must return `202 Accepted` without blocking on LLM/CRM execution. Handle network timeouts via `WEBHOOK_RETRY_PENDING`, support `DEMO_SIMULATE_N8N_IF_SLEEPING=true`, and handle n8n `error-dlq` callbacks (`TRIAGE_FAILED_MANUAL_REVIEW`).
- **XML-Sandboxed Prompts & Emergency Short-Circuit (`ADR-005`):** Isolate untrusted symptom text inside `<untrusted_symptom_text>` tags, validate AI JSON outputs with Zod, and short-circuit `urgency_level === "CRITICAL"` to an emergency 911 advisory.
- **Frictionless Demo Clinician RBAC (`ADR-006`):** Protect `/admin/vault/[id]` with real `jose` JWT verification and provide the 1-click *"Sign in as Demo Clinician (Dr. Sarah Chen)"* action (`actorId: "dr_chen_demo"`).
- **Two-Layer Idempotency & Burned Capability Tokens (`ADR-007`):** Enforce `WebhookIdempotency` keys and burn onboarding capability tokens (`tokenUsedAt = now()`) upon appointment booking.
- **Immutable Audit Logging:** Every state transition and PHI decryption view must write to `AuditLog`. Never attempt to `UPDATE` or `DELETE` rows in `AuditLog`.
