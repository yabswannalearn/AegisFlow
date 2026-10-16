# ADR-005: XML-Sandboxed AI Prompts & Emergency Clinical Short-Circuit

- **Status:** Accepted
- **Context:** Free-text symptom inputs are vulnerable to prompt injection, and autonomous AI onboarding of life-threatening emergencies (`CRITICAL` urgency) is a clinical safety hazard.
- **Decision:** 
  1. Isolate user input inside `<untrusted_symptom_text>` XML delimiters in the n8n AI Agent prompt, instructing the model to ignore any imperative commands inside the tags.
  2. Double-validate the AI's JSON output using n8n's Structured Output Parser *and* a strict Zod schema on the Next.js callback route.
  3. Branch on `urgency_level === "CRITICAL"` in n8n to trigger an immediate `[RED ALERT]` Slack/Discord notification and halt standard self-scheduling onboarding in favor of an emergency advisory screen.
- **Consequences:**
  - *(+)* Prevents prompt injection from hijacking CRM fields; demonstrates clinical AI guardrails.
