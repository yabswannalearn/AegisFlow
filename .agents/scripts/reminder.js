// PreInvocation: injects a short guardrail reminder and any pending check failures.
const fs = require("fs");
const { CHECK_FILE, readInput, respond } = require("./lib");

const REMINDER = [
  "AegisFlow guardrails: no plaintext PHI to n8n/HubSpot (ADR-001); scrub symptoms with known entities (ADR-002);",
  "AuditLog is append-only; never modify .env files; keep PROGRESS.md in sync with your work.",
].join(" ");

readInput();
const messages = [REMINDER];

if (fs.existsSync(CHECK_FILE)) {
  messages.push(`Automated checks failed after your last edit. Fix before continuing:\n${fs.readFileSync(CHECK_FILE, "utf8")}`);
  fs.unlinkSync(CHECK_FILE);
}

respond({ injectSteps: messages.map((m) => ({ ephemeralMessage: m })) });
