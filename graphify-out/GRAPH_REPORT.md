> Built locally from repository source on 2026-10-17 (Asia/Shanghai). This graph is a code/document map, not a runtime health check or clinical validation.
>
> **Fresh runtime observation from the primary agent, 2026-10-17 11:23 Asia/Shanghai:** Docker engine was unavailable; app port 3005 and n8n port 5678 requests failed. The successful live checks documented below happened on 2026-10-16. Do not interpret historical passing tests as a statement that the demo is running now.

## How to use this supporting graph

Open `graph.html`, search a concept or function, select its node, then inspect its neighbors and source path. Communities group densely connected source symbols; small isolated communities often reflect configuration files rather than deployed services. Arrows preserve the original source/target in `graph.json`, while layout clustering uses an undirected graph. The separately authored architecture explorer is the beginner-friendly system explanation; this output is the persistent source relationship index.

The graph bundles vis-network 9.1.6 locally after checking its pinned SHA-384 integrity value, so it requires no CDN request at runtime. A headless Edge verification opened the local file with all external HTTP(S) blocked, rendered the canvas, searched `dispatchBlindNotification`, and selected the matching node. It reported zero page errors and zero external requests. JSON verification also checked every edge endpoint and confidence score.

## Scope and extraction audit

- Included repository application source, tests, four workflow JSON definitions, Prisma schema, architecture docs, and safe Compose/config files.
- Excluded all `.env*`, `.runtime/`, dependency/build/test output folders, fonts, transcript, local generated HTML, `.agents/` tooling, and the local n8n environment override. No patient records, credential values, container data, or external systems were read by this graph build.
- ADR-007 was explicitly allowed as a known safe architecture document after the detector matched its filename's token terminology.
- Structural extraction used the installed graphify AST parser. An additional deterministic parser indexed named workflow nodes/connections and Prisma model relationships. Semantic extraction used one delegated 20-document chunk; inferred concept-to-implementation links are labeled INFERRED with confidence 0.85.
- Semantic API token usage is **unavailable** from the collaboration tool. The graphify schema contains zero placeholders; these are not measured usage and do not establish zero cost. Actual token cost: **unknown**. The compression benchmark estimates retrieval size, not model quality or billing.

## Current implementation versus original intent

| Topic | Source-backed implementation and assessment |
| --- | --- |
| AI and external tools | Gemini is the n8n language model. Two HTTP tools return synthetic insurance/routing rules from Next.js. These are demonstrations, not real payer APIs. See `scripts/generate-workflows.mjs`, `src/app/api/mock/insurance/route.ts`, and `src/app/api/mock/routing-rules/route.ts`. |
| HubSpot boundary | `syncHubspot()` sends pseudonymous first name/email, lifecycle stage, deal UUID/name, pipeline/stage, and protected vault URL. It does not send symptom text, copay, or specialty in its current request bodies. See `src/lib/integrations.ts:21`. |
| Notification | Gmail dispatch lives in Next.js; n8n requests dispatch using the patient UUID. Manual demo uses PREVIEW_ONLY unless an explicit controlled recipient is configured. A historical one-message Gmail self-test is separate evidence. See `src/lib/integrations.ts:145`, `docs/VERIFICATION.md`. |
| Global dead-letter handler | The fourth workflow exists, but main workflow settings do not contain `errorWorkflow` and patient custom-data propagation is absent. Its existence is not proof that every failure reaches it. Current triage has an explicit error branch; the outbox also retries and reconciles callback deadlines. See `scripts/generate-workflows.mjs:18`, `:32`, `:44`, and `src/lib/outbox.ts`. |
| Emergency path | A CRITICAL callback is normalized to Emergency Care/Emergency911 with copay 0 and blocks ordinary approval/booking. The original ADR-005 Slack/Discord red-alert dispatch is not implemented in the generated workflows. See `src/lib/vault-store.ts:201`, `:312`, `:405`, and `scripts/generate-workflows.mjs`. |
| KYC | Onboarding stores an encrypted ID type and last-four value, then writes KYC_VERIFIED. It does not verify identity with a provider or inspect an uploaded document. See `src/lib/vault-store.ts:405`. |
| Appointment booking | The transaction checks that the appointment is a valid future date and burns the token under a row lock. It does not reserve shared real-calendar inventory. See `src/lib/vault-store.ts:405`. |
| Worker deployment | Deliveries are durable in PostgreSQL. The worker itself is a 3-second timer inside the Next.js process when AEGIS_OUTBOX_WORKER is enabled, so it pauses when the app is down and resumes after restart. See `src/instrumentation.ts`, `src/lib/outbox.ts`. |
| Safety claims | Contextual/regex scrubbing reduces exposure but can miss arbitrary identifiers. XML delimiters and schemas constrain an AI workflow; they do not prove injection immunity or clinical accuracy. Demo login, consent, and scheduling remain synthetic. See `README.md`, `docs/VERIFICATION.md`, ADR-002 and ADR-006. |

# AegisFlow Supporting Knowledge Graph - D:\vscode\Personal\AegisFlow  (2026-10-17)

## Corpus Check
- Corpus is ~34,450 words - fits in a single context window. You may not need a graph.

## Summary
- 339 nodes · 621 edges · 30 communities (23 shown, 7 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.85)
- Token cost: unknown input · unknown output

## Community Hubs (Navigation)
- [[_COMMUNITY_Vault transactions and recovery|Vault transactions and recovery]]
- [[_COMMUNITY_Architecture and portfolio evidence|Architecture and portfolio evidence]]
- [[_COMMUNITY_Framework and dependencies|Framework and dependencies]]
- [[_COMMUNITY_Authentication and guarded approval|Authentication and guarded approval]]
- [[_COMMUNITY_Patient and clinician screens|Patient and clinician screens]]
- [[_COMMUNITY_TypeScript compiler settings|TypeScript compiler settings]]
- [[_COMMUNITY_Gemini triage workflow|Gemini triage workflow]]
- [[_COMMUNITY_Signed callbacks and integrations|Signed callbacks and integrations]]
- [[_COMMUNITY_Development commands|Development commands]]
- [[_COMMUNITY_Approval and blind notification workflow|Approval and blind notification workflow]]
- [[_COMMUNITY_Workflow source generator|Workflow source generator]]
- [[_COMMUNITY_Booking completion workflow|Booking completion workflow]]
- [[_COMMUNITY_HubSpot pipeline configuration|HubSpot pipeline configuration]]
- [[_COMMUNITY_Illustrative agent evaluation|Illustrative agent evaluation]]
- [[_COMMUNITY_Database test runner|Database test runner]]
- [[_COMMUNITY_Origin and route middleware|Origin and route middleware]]
- [[_COMMUNITY_Standalone error workflow|Standalone error workflow]]
- [[_COMMUNITY_Document layout|Document layout]]
- [[_COMMUNITY_Frontend visual guidance|Frontend visual guidance]]
- [[_COMMUNITY_Next.js runtime configuration|Next.js runtime configuration]]
- [[_COMMUNITY_Browser test configuration|Browser test configuration]]
- [[_COMMUNITY_Tailwind visual tokens|Tailwind visual tokens]]
- [[_COMMUNITY_Async webhook decision|Async webhook decision]]

## God Nodes (most connected - your core abstractions)
1. `AegisFlow — Gemini triage agent` - 21 edges
2. `compilerOptions` - 16 edges
3. `scripts` - 15 edges
4. `requiredSecret()` - 13 edges
5. `sha256Hash()` - 11 edges
6. `dispatchPendingOutbox()` - 11 edges
7. `processPatientIntake()` - 11 edges
8. `Next.js security gateway` - 11 edges
9. `decryptPhi()` - 10 edges
10. `AegisFlow — Clinician approval and Gmail blind dispatch` - 10 edges

## Surprising Connections (you probably didn't know these)
- `Blind notification endpoint` --implemented_by--> `dispatchBlindNotification()`  [INFERRED]
  docs/adr/001-zero-phi-hubspot-pseudonymization.md → src/lib/integrations.ts
- `Workflow 1: Gemini triage` --implemented_by--> `AegisFlow — Gemini triage agent`  [INFERRED]
  docs/MANUAL_TESTING.md → n8n/workflows/triage-agent.json
- `Gemini tool-calling agent` --implemented_by--> `AegisFlow — Gemini triage agent`  [INFERRED]
  README.md → n8n/workflows/triage-agent.json
- `docs/adr/007-two-layer-idempotency-and-burned-tokens.md` --implemented_by--> `WebhookIdempotency`  [INFERRED]
  docs/adr/007-two-layer-idempotency-and-burned-tokens.md → prisma/schema.prisma
- `Append-only AuditLog` --implemented_by--> `AuditLog`  [INFERRED]
  PRD.md → prisma/schema.prisma

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Intake commits state and dispatch together** — af_patient_vault, af_consent, af_audit, af_outbox [EXTRACTED 1.00]
- **Blind dispatch resolves identity inside the gateway** — af_workflow_dispatch, af_blind_notify, af_patient_vault, af_gmail [EXTRACTED 1.00]
- **Tool-calling structured routing** — af_workflow_triage, af_gemini, af_insurance_tool, af_routing_tool, af_validation [EXTRACTED 1.00]

## Communities (30 total, 7 thin omitted)

### Community 0 - "Vault transactions and recovery"
Cohesion: 0.08
Nodes (45): CompleteOnboardingSchema, GET(), POST(), POST(), canInspect(), WriteAuditParams, appUrl(), isDemoMode() (+37 more)

### Community 1 - "Architecture and portfolio evidence"
Cohesion: 0.06
Nodes (53): AegisFlow synthetic portfolio demonstration, Pseudonymous full-UUID CRM alias, Append-only AuditLog, Blind notification endpoint, Atomic onboarding and token burn, Single-use 48-hour onboarding capability, Clinician human review, Consent records (+45 more)

### Community 2 - "Framework and dependencies"
Cohesion: 0.08
Nodes (24): dependencies, jose, lucide-react, next, @prisma/client, react, react-dom, zod (+16 more)

### Community 3 - "Authentication and guarded approval"
Cohesion: 0.19
Nodes (14): approve(), GET(), POST(), POST(), GET(), ClinicianSessionPayload, DEMO_CLINICIAN_PROFILE, getJwtSecretKey() (+6 more)

### Community 4 - "Patient and clinician screens"
Cohesion: 0.17
Nodes (12): Field(), journey, StatusBadge(), WorkspaceFooter(), WorkspaceHeader(), DecryptedVaultResponse, SPECIALIST_OPTIONS, PRESET_SCENARIOS (+4 more)

### Community 5 - "TypeScript compiler settings"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 6 - "Gemini triage workflow"
Cohesion: 0.21
Nodes (20): AegisFlow — Gemini triage agent, Accept dispatch, Authorized?, check_insurance_eligibility, Complete triage callback, Dead-letter callback, fetch_clinical_routing_rules, Gemini triage agent (+12 more)

### Community 7 - "Signed callbacks and integrations"
Cohesion: 0.21
Nodes (11): POST(), getWebhookSecret(), SignedWebhookHeaders, signWebhookPayload(), verifyWebhookSignature(), dispatchBlindNotification(), syncHubspot(), applyN8nTriageCallback() (+3 more)

### Community 8 - "Development commands"
Cohesion: 0.13
Nodes (15): scripts, build, crm:setup, db:generate, db:migrate, dev, env:init, eval:gemini (+7 more)

### Community 9 - "Approval and blind notification workflow"
Cohesion: 0.35
Nodes (11): AegisFlow — Clinician approval and Gmail blind dispatch, Accept dispatch, Authorized?, Blind Gmail dispatch, Prepare intake, Reject signature, Sign blind notification, Sign CRM sync (+3 more)

### Community 10 - "Workflow source generator"
Cohesion: 0.33
Nodes (8): base(), code(), credential, dlq, node(), request(), schema, {workflow:w,link}

### Community 11 - "Booking completion workflow"
Cohesion: 0.42
Nodes (9): AegisFlow — Appointment completion and HubSpot sync, Accept dispatch, Authorized?, Prepare intake, Reject signature, Sign CRM sync, Signed webhook, Update HubSpot (+1 more)

### Community 12 - "HubSpot pipeline configuration"
Cohesion: 0.25
Nodes (6): env, headers, open, pipeline, values, won

### Community 13 - "Illustrative agent evaluation"
Cohesion: 0.50
Nodes (3): cases, report, results

### Community 14 - "Database test runner"
Cohesion: 0.50
Nodes (3): create, env, url

### Community 16 - "Standalone error workflow"
Cohesion: 0.83
Nodes (4): AegisFlow — Sanitized dead-letter handler, Prepare sanitized callback, Send dead-letter callback, Workflow error

## Knowledge Gaps
- **97 isolated node(s):** `nextConfig`, `name`, `version`, `private`, `env:init` (+92 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Blind notification endpoint` connect `Architecture and portfolio evidence` to `Signed callbacks and integrations`?**
  _High betweenness centrality (0.150) - this node is a cross-community bridge._
- **Why does `dispatchBlindNotification()` connect `Signed callbacks and integrations` to `Vault transactions and recovery`, `Architecture and portfolio evidence`?**
  _High betweenness centrality (0.149) - this node is a cross-community bridge._
- **Why does `Workflow 1: Gemini triage` connect `Architecture and portfolio evidence` to `Gemini triage workflow`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `AegisFlow — Gemini triage agent` (e.g. with `Gemini tool-calling agent` and `Workflow 1: Gemini triage`) actually correct?**
  _`AegisFlow — Gemini triage agent` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `nextConfig`, `name`, `version` to the rest of the system?**
  _100 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Vault transactions and recovery` be split into smaller, more focused modules?**
  _Cohesion score 0.07832167832167833 - nodes in this community are weakly interconnected._
- **Should `Architecture and portfolio evidence` be split into smaller, more focused modules?**
  _Cohesion score 0.060655737704918035 - nodes in this community are weakly interconnected._
