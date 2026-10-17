# Interface direction

AegisFlow is a synthetic healthcare workflow demonstration for recruiters and engineers. The interface should make the patient journey understandable before exposing its implementation evidence.

The visual system uses a cool cloud canvas (`#F5F7FC`), white paper (`#FFFFFF`), ink (`#152442`), clear blue (`#315BE6`), quiet blue (`#EDF1FF`), and restrained teal (`#147C78`). Sora carries headings and the wordmark; Manrope carries forms and reading text. Fonts are served locally, with their OFL licenses in `public/fonts`.

The signature element is the four-stage journey rail: intake, AI routing, clinician review, onboarding. It represents the actual sequence. On smaller screens it becomes a compact icon rail. The onboarding portal has its own three-step form navigation within the final stage.

The intake inspector keeps routing results visible and puts encryption, redaction, delivery payloads, and raw audit evidence behind disclosures. Clinician review separates the patient's own words from the model's suggestion and gives approval a clear home. The onboarding portal uses plain language, an explicit synthetic signature, and a readable receipt.

Shared components live in `src/components/workspace-ui.tsx`; the scoped `af-` classes in `src/app/globals.css` own the visual system. Visible keyboard focus, icon-only accessible labels, reduced-motion support, and mobile overflow checks are part of the implementation. `e2e/design.spec.ts` uses explicit synthetic API fixtures for layout verification; `e2e/lifecycle.spec.ts` verifies the real integrated flow.
