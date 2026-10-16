# ADR-006: Frictionless Demo RBAC Session Minting

- **Status:** Accepted
- **Context:** Enforcing clinician login on `/admin/vault/[id]` proves HIPAA access control, but standard sign-up/login screens cause technical recruiters to bounce during portfolio reviews.
- **Decision:** Protect `/admin/vault/[id]` with real `jose` JWT cookie middleware, and provide a **"Sign in as Demo Clinician (Dr. Sarah Chen)"** one-click action in the X-Ray UI and login barrier that mints a real 1-hour JWT (`sub: "dr_chen_demo"`, `role: "CLINICIAN"`).
- **Consequences:**
  - *(+)* 100% real RBAC middleware and accurate `AuditLog` attribution (`actorId: "dr_chen_demo"`) with zero recruiter friction.
