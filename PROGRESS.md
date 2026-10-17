# AegisFlow — Project Progress Board (Kanban)

> **Agent Instruction:** Always keep this board up to date! Whenever you start, update, or complete a task/feature, move its item across the columns (`📋 Backlog` -> `🚧 In Progress` -> `🧪 In Review / Testing` -> `✅ Done`) and update the **Last Updated** log at the bottom. See [AGENTS.md](file:///D:/vscode/Personal/AegisFlow/AGENTS.md) for full workflow rules.

---

## 📊 Phase Summary

| Phase | Name | Status | Progress |
| :--- | :--- | :--- | :--- |
| **Phase 0** | Specification, Glossary & ADRs (`/grill-with-docs`) | ✅ Done | 100% |
| **Phase 1** | Foundation, Docker Compose & Database Layer | ✅ Done | 100% |
| **Phase 2** | Lightweight Security Core (~150 LOC) & Unit Tests | ✅ Done | 100% |
| **Phase 3** | Backend API Routes, Mock Tools & Simulated n8n Fallback | ✅ Done | 100% |
| **Phase 4** | Patient Intake UI & Split-Screen "Developer X-Ray" Inspector | ✅ Done | 100% |
| **Phase 5** | Clinician HITL Vault & 3-Step Patient Onboarding Portal | ✅ Done | 100% |
| **Phase 6** | Git-Tracked n8n Workflows (#1–#4), HubSpot Sync & E2E Suite | ✅ Done | 100% |
| **Phase 7** | Verified Gemini Agent, Durable Lifecycle & Portfolio Hardening | 🚧 In Progress | 89% |
| **Phase 8** | Modern Frontend & Responsive Experience | ✅ Done | 100% |
| **Phase 9** | Architecture Explorer & Portfolio Learning Guide | ✅ Done | 100% |

---

## 🗂️ Kanban Board

### 🚧 In Progress
*(Move active tasks here before writing code)*

---

### 🧪 In Review / Testing
*(Tasks implemented and awaiting verification gate pass)*
- [ ] **[OPS-02]** Backend and frontend commits created; documentation commit and remote publication pending. TypeScript, 11 unit checks, and 12 isolated PostgreSQL integration checks passed. Publication scan found no known credentials or vendor-token patterns in publishable text; local environment, credentials, runtime/browser artifacts, and graph bookkeeping are excluded.
- [ ] **[P7-07]** Seven task-created exports removed and verified absent from both n8n containers. Four local decrypted exports remain: automatic approval review rejected their deletion again despite explicit user approval (`blocked by policy`). Working `.env` verified unchanged.

---

### 📋 Backlog (Todo)
- _Original phases are implemented as a demo; Phase 7 verifies and completes the external integrations and durability claims._

---

### ✅ Done

#### Latest verified work
- [x] **[OPS-01]** Started Docker and the selected local stack on 17 October. App 3005 and n8n 5678 are ready, PostgreSQL is healthy and reachable from the app, the outbox worker is enabled, and all three AegisFlow webhooks reject unsigned requests with 401. Refreshed the guide's runtime snapshot.
- [x] **[P9-01]** Created the offline architecture explorer and source graph, with clickable components, four request traces, data boundaries, database/API explanations, reading path, portfolio assessment, and quiz. Verified offline interactions, keyboard access, checklist persistence, print, and 30 responsive view checks. Current stopped runtime is distinguished from historical passing tests.
- [x] **[P7-09]** Manual-test readiness verified on the running app: six browser scenarios passed again, then the strengthened lifecycle check passed with explicit approval-stage CRM and notification-preview assertions. Added a manual walkthrough and confirmed real integrations, simulation disabled, booking, token burn, and background dispatch.
- [x] **[P7-08]** Updated all four existing AegisFlow workflows in n8n on port 5678, published the three webhook flows, connected the app, and stopped the unused 5679 instance. Both live browser checks passed; all 36 unrelated workflows and 12 saved credentials preserved.
- [x] **[P7-05]** Truthful portfolio documentation, local Docker app/migration images, deployment runbook, screenshots, and walkthrough video verified. User chose local-only hosting.
- [x] **[P8-02]** All six browser tests pass on the final Docker build: desktop/mobile layouts, keyboard controls, live Gemini/HubSpot lifecycle, booking, token replay, and emergency blocking.
- [x] **[P7-06]** Docker runtime storage relocated to D: with verified disks and a retained backup; direct WSL registration restored, all four existing containers healthy, and AegisFlow data preserved.
- [x] **[P7-01]** Transactional PostgreSQL lifecycle, durable dispatch, retry/deadline recovery, idempotency, atomic token burn, and invitation renewal verified with 12 integration checks.
- [x] **[P8-01]** Modern intake, clinician review, and onboarding implemented with a shared visual system, local variable fonts, journey navigation, and responsive layouts.

#### Phase 7: Verified live integrations and security
- [x] **[P7-02]** Connect a real Gemini tool-calling agent, pseudonymous HubSpot integration, and Gmail blind notification dispatch; label simulation explicitly.
- [x] **[P7-03]** Protect telemetry, enforce HMAC verification and configured secrets, and block emergency onboarding server-side.
- [x] **[P7-04]** Verify database invariants, failure recovery, AI evaluations, and the complete browser lifecycle with synthetic fixtures.

#### Phase 0: Specification, Glossary & ADRs
- [x] **[P0-01]** Extract full 18-turn architecture and `/grill-with-docs` session transcript ([docs/conversation-transcript.md](file:///D:/vscode/Personal/AegisFlow/docs/conversation-transcript.md)).
- [x] **[P0-02]** Create Master Product Requirements Document ([PRD.md](file:///D:/vscode/Personal/AegisFlow/PRD.md)) and printable HTML specification ([docs/aegisflow_prd.html](file:///D:/vscode/Personal/AegisFlow/docs/aegisflow_prd.html)).
- [x] **[P0-03]** Define domain ubiquitous language in [GLOSSARY.md](file:///D:/vscode/Personal/AegisFlow/GLOSSARY.md).
- [x] **[P0-04]** Document Architecture Decision Records [ADR-001](file:///D:/vscode/Personal/AegisFlow/docs/adr/001-zero-phi-hubspot-pseudonymization.md) through [ADR-007](file:///D:/vscode/Personal/AegisFlow/docs/adr/007-two-layer-idempotency-and-burned-tokens.md).
- [x] **[P0-05]** Create step-by-step implementation plan ([IMPLEMENTATION_PLAN.md](file:///D:/vscode/Personal/AegisFlow/IMPLEMENTATION_PLAN.md)) and Kanban tracking board ([PROGRESS.md](file:///D:/vscode/Personal/AegisFlow/PROGRESS.md)).

#### Phase 1: Foundation, Docker & Database Layer
- [x] **[P1-01]** Scaffold Next.js 15 project (App Router, TypeScript, Tailwind CSS, `src/` directory) and install core dependencies (`prisma`, `@prisma/client`, `zod`, `jose`, `lucide-react`, `vitest`).
- [x] **[P1-02]** Create `docker-compose.yml` (`postgres:16-alpine` + `n8nio/n8n:latest` with `EXECUTIONS_DATA_SAVE_ON_SUCCESS=none`) and `.env.example`.
- [x] **[P1-03]** Define `prisma/schema.prisma` (`PatientVault`, `ConsentRecord`, `AuditLog`, `WebhookIdempotency`).
- [x] **[P1-04]** Create PostgreSQL migration with `prevent_audit_log_modification()` trigger to enforce append-only immutability on `"AuditLog"`.

#### Phase 2: Lightweight Security Core (~150 LOC) & Unit Tests
- [x] **[P2-01]** Implement `src/lib/crypto.ts` (`AES-256-GCM` field encryption `v1:iv:authTag:ciphertext`, `sha256Hash`, and `generatePseudonymousAlias` per [ADR-001](file:///D:/vscode/Personal/AegisFlow/docs/adr/001-zero-phi-hubspot-pseudonymization.md)).
- [x] **[P2-02]** Implement `src/lib/hmac.ts` (`HMAC-SHA256` payload signer and timing-safe verifier with `±300s` replay window).
- [x] **[P2-03]** Implement `src/lib/scrubber.ts` (Contextual known-entity matcher + 6-pass regex pipeline returning `scrubbedText` and `redactedSpans` per [ADR-002](file:///D:/vscode/Personal/AegisFlow/docs/adr/002-contextual-known-entity-scrubber.md)).
- [x] **[P2-04]** Implement `src/lib/auth.ts` (`jose` Clinician RBAC JWT + 1-click `dr_chen_demo` session minting per [ADR-006](file:///D:/vscode/Personal/AegisFlow/docs/adr/006-frictionless-demo-rbac-session.md)) and `src/lib/audit.ts` (append-only `AuditLog` helper).
- [x] **[P2-05]** Pass Verification Gates 1–3 in Vitest (25 synthetic clinical PII scrub tests with 0% leak, AES-GCM/HMAC tamper tests, and DB `AuditLog` immutability trigger test).

#### Phase 3: Backend API Routes, Mock Tools & Simulated n8n Fallback
- [x] **[P3-01]** Implement `POST /api/intake` (Zod validation, two-layer idempotency check, Vault encryption, PII scrubbing, async webhook dispatch returning `202 Accepted` per [ADR-003](file:///D:/vscode/Personal/AegisFlow/docs/adr/003-async-webhook-callback-polling.md), Outbox retry state per [ADR-004](file:///D:/vscode/Personal/AegisFlow/docs/adr/004-outbox-and-dlq-failure-recovery.md), and simulated n8n fallback per [ADR-007](file:///D:/vscode/Personal/AegisFlow/docs/adr/007-two-layer-idempotency-and-burned-tokens.md)).
- [x] **[P3-02]** Implement `GET /api/intake/[id]/telemetry` (1s polling endpoint for X-Ray UI) and `POST /api/intake/[id]/retry` (Outbox manual retry).
- [x] **[P3-03]** Implement n8n AI Agent HTTP Tools: `GET /api/mock/insurance` and `GET /api/mock/routing-rules` (authenticated via `x-aegis-tool-key`).
- [x] **[P3-04]** Implement `POST /api/webhooks/n8n-callback` (HMAC verification, Zod triage validation, `CRITICAL` emergency short-circuit per [ADR-005](file:///D:/vscode/Personal/AegisFlow/docs/adr/005-xml-sandboxed-prompt-and-critical-short-circuit.md), and `error-dlq` failure recovery per [ADR-004](file:///D:/vscode/Personal/AegisFlow/docs/adr/004-outbox-and-dlq-failure-recovery.md)).
- [x] **[P3-05]** Implement `POST /api/auth/demo-session`, `POST /api/vault/[id]/approve` (48h SHA-256 token generation + n8n #2 trigger), `POST /api/internal/notify` (Blind Notification Dispatch per [ADR-001](file:///D:/vscode/Personal/AegisFlow/docs/adr/001-zero-phi-hubspot-pseudonymization.md)), and `POST /api/onboarding/[token]/complete` (KYC + NPP e-sign + slot booking + `tokenUsedAt` burn + n8n #3 trigger).

#### Phase 4: Patient Intake UI & Split-Screen "Developer X-Ray" Inspector
- [x] **[P4-01]** Build Patient Intake Portal (`src/app/intake/page.tsx` & `/`) with sample patient preset buttons (*Routine*, *High-Urgency*, *Critical Emergency*, *Prompt Injection Attempt*) and emergency `911` short-circuit banner.
- [x] **[P4-02]** Build 4-Panel Split-Screen "Developer X-Ray" Inspector (Panel 1: Raw Input & Redaction Diff; Panel 2: Postgres AES-256 Ciphertext & Immutable Audit Log; Panel 3: Scrubbed n8n Webhook & HMAC Inspector; Panel 4: AI Triage JSON & HubSpot Pipeline Card).

#### Phase 5: Clinician HITL Vault & 3-Step Patient Onboarding Portal
- [x] **[P5-01]** Build Clinician HITL Vault (`src/app/admin/vault/[id]/page.tsx`) with RBAC barrier, 1-click *"Sign in as Demo Clinician (Dr. Sarah Chen)"*, audited decryption banner (`PHI_DECRYPTED_VIEW`), and 1-click Approval action.
- [x] **[P5-02]** Build 3-Step Patient Onboarding Portal (`src/app/onboarding/[token]/page.tsx`) with single-use token validation, Step 1 KYC Insurance Card check, Step 2 Telehealth NPP E-Signature, Step 3 Specialist Slot Picker, and burned-token read-only receipt view.

#### Phase 6: Git-Tracked n8n Workflows, HubSpot Setup & E2E Verification
- [x] **[P6-01]** Author declarative n8n workflow JSONs in `n8n/workflows/`: `triage-agent.json` (#1, imported directly into live n8n workflow `TCc5M9TUgKMpOJHN`), `onboarding-dispatch.json` (#2), `onboarding-complete.json` (#3), and `error-dlq.json` (#4).
- [x] **[P6-02]** Run End-to-End Verification Gate 4 (Closed-loop intake $\rightarrow$ triage $\rightarrow$ HITL approval $\rightarrow$ onboarding completion $\rightarrow$ token burn) and write portfolio `README.md`.

---

## 📝 Changelog / Activity Log

| Timestamp (Local) | Agent / Actor | Task ID | Summary of Update |
| :--- | :--- | :--- | :--- |
| `2026-10-16` | Codex | `P7-01`..`P7-05` | Started the user-authorized Gemini agent, durable persistence, genuine integrations, security hardening, verification, and portfolio work. Gmail replaces Resend at the user's request. |
| `2026-10-16 08:57` | Antigravity | `P0-01`..`P0-05` | Initialized `PRD.md`, `GLOSSARY.md`, `docs/adr/001..007`, `IMPLEMENTATION_PLAN.md`, `PROGRESS.md`, and `AGENTS.md`. |
| `2026-10-16 09:02` | Antigravity | `P1-02`..`P1-04` | Created `docker-compose.yml`, `.env.example`, `prisma/schema.prisma`, and SQL migration with `AuditLog` append-only immutability trigger. |
| `2026-10-16 09:06` | Antigravity | `P1-01` | Completed Next.js 15 scaffold, installed dependencies (`prisma`, `zod`, `jose`, `lucide-react`, `vitest`), and generated Prisma Client. Phase 1 complete (100%). |
| `2026-10-16 09:29` | Antigravity | `P2-01`..`P2-04` | Implemented `crypto.ts`, `hmac.ts`, `scrubber.ts`, `auth.ts`, and `audit.ts`. Moved `P2-05` to In Review / Testing. |
| `2026-10-16 09:31` | Antigravity | `P2-05` | Passed all 7 Vitest suites in `src/__tests__/security.test.ts` (25 synthetic PII scrub cases with 0% leak, AES-256-GCM/HMAC tamper tests, RBAC JWT verification, and AuditLog immutability DDL verification). Phase 2 complete (100%). |
| `2026-10-16 09:41` | Antigravity | `P3-01`..`P3-05`, `P6-01` | Implemented all Phase 3 backend API routes (`vault-store.ts`, `/api/intake`, `/api/intake/[id]/telemetry`, `/api/mock/*`, `/api/webhooks/n8n-callback`, `/api/auth/demo-session`, `/api/vault/[id]/approve`, `/api/internal/notify`, `/api/onboarding/[token]/complete`) and imported all 4 n8n workflows into `TCc5M9TUgKMpOJHN` (`projectId=1NBT5R7NlkdRHHPk`). Phase 3 complete (100%). |
| `2026-10-16 09:49` | Antigravity | `P4-01`, `P4-02` | Built Patient Intake UI (`src/app/intake/page.tsx` & `src/app/page.tsx`) with 4 sample test presets, emergency 911 short-circuit banner, and 4-panel Split-Screen Developer X-Ray Telemetry Inspector. Phase 4 complete (100%). |
| `2026-10-16 10:14` | Antigravity | `P5-01`, `P5-02`, `P6-02` | Built Clinician HITL Decryption Vault (`src/app/admin/vault/[id]/page.tsx`), 3-Step Patient Onboarding Portal (`src/app/onboarding/[token]/page.tsx`), and portfolio `README.md`. All Phases (0–6) complete (100%). |
| `2026-10-16 12:23` | Antigravity | `P6-01` | Replaced `require('crypto')` in n8n workflows (`triage-agent.json`, `onboarding-dispatch.json`, `error-dlq.json`) with sandbox-safe pure-JS `HMAC-SHA256` and updated callback URLs to port `3005`. |

| `2026-10-16` | Codex | `P7-01`..`P7-04` | PostgreSQL migration, concurrent token burn, database audit immutability, signed n8n workflows, live Gemini tool calls, and real HubSpot Contact/Deal creation verified. User approved HubSpot scopes, the reserved alias domain, and temporary encrypted token retention. Browser and Gmail verification ongoing. |
| `2026-10-16 13:52` | Codex | `P7-01`..`P7-04` | Verified real Gemini/HubSpot lifecycle, one Gmail self-test delivered, 8 unit + 10 PostgreSQL + 2 browser tests, 4 AI examples, restart persistence, retry/lease recovery, audit immutability, emergency blocking, and token burn. Final local Docker runtime verification pending. |
| `2026-10-16 14:22` | Codex | `P7-06`, `P8-01` | Moved all local Docker runtime data to D: with SHA-256 verified virtual disks, a retained backup, and a compatibility junction. Modern UI implemented across all three screens; four responsive/keyboard checks passed with synthetic layout fixtures. |
| `2026-10-16 14:33` | Codex | `P7-01`, `P7-06`, `P8-01` | Docker restored with all existing containers and volumes; pre-migration case and Gmail state intact. All 12 PostgreSQL tests passed, including callback exhaustion and invitation renewal. Final Docker image and redesigned live browser verification ongoing. |
| `2026-10-16 15:06` | Codex | `P7-03`, `P7-05`, `P8-02` | Final Docker app and migration command verified. Fixed public-origin validation through container port mapping, tested cross-site rejection, and verified alternate-email redaction. 11 unit, 12 PostgreSQL, and 6 browser checks pass. Updated UI screenshots and live walkthrough video captured. Temporary credential-export cleanup awaits explicit approval after automatic-review rejection. |
| `2026-10-16 15:47` | Codex | `P7-07` | User explicitly approved credential-export cleanup. Removed all seven task-created container exports and verified absence; working `.env` unchanged. Automatic approval review again rejected deletion of the four local exports with only `blocked by policy`; cleanup remains incomplete. |
| `2026-10-16 15:54` | Codex | `P7-08` | Updated the same four workflow IDs in the user's existing n8n on 5678; published three webhook workflows, switched app URLs, and stopped 5679. Source equality, all three unsigned-request 401 responses, unchanged unrelated workflows/credentials, Compose validation, and both live browser scenarios verified (49.6 seconds). Added reproducible existing-instance Compose overrides and runbook. |
| `2026-10-16 16:04` | Codex | `P7-09` | Reverified app/n8n health, matching integration secrets, live Gemini/HubSpot with simulation disabled, and all six browser checks (40.4 seconds). Strengthened the live lifecycle to await APPROVED CRM state and PREVIEW_ONLY notification before booking; passed again (20.4 seconds). Added docs/MANUAL_TESTING.md and linked it from README. App remains running for the user's manual test. |
| `2026-10-17 11:31` | Codex | `P9-01` | Built docs/architecture-explorer.html (self-contained fonts/scripts) and a supporting 339-node/621-edge source graph. Verified 8 component selections, 4 scenarios, 5 data destinations, 5 tables, 6 quiz questions, checklist persistence, keyboard/print behavior, and 30 responsive views with zero page errors/external requests. Read-only preview serves approved guide files on loopback 8787; secrets/runtime paths return 404. Recorded Docker/app unavailable today and historical test evidence separately; no app/workflow changes. Optional source-only graph-temp cleanup was rejected by automatic review (`blocked by policy`); files remain ignored. |
| `2026-10-17 11:38` | Codex | `OPS-01` | Started Docker Desktop and restored the existing n8n configuration plus app/PostgreSQL Compose stack. Verified app HTTP 200, n8n readiness HTTP 200, database connectivity, enabled outbox worker, and unsigned 401 responses from all three AegisFlow webhooks. Kept alternative 5679 instance stopped; no credentials/workflows changed. Refreshed the architecture guide runtime snapshot. |
