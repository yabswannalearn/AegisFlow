// SessionStart hook: injects all required AegisFlow docs into a new agent session.
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const ADR_DIR = path.join("docs", "adr");

const adrFiles = fs.existsSync(path.join(ROOT, ADR_DIR))
  ? fs
      .readdirSync(path.join(ROOT, ADR_DIR))
      .filter((f) => f.endsWith(".md"))
      .sort()
      .map((f) => path.join(ADR_DIR, f))
  : [];

const docs = ["PROGRESS.md", "IMPLEMENTATION_PLAN.md", "PRD.md", "GLOSSARY.md", ...adrFiles];

const sections = docs.map((rel) => {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) return `### ${rel}\n(MISSING - report this to the user)`;
  return `### ${rel}\n${fs.readFileSync(full, "utf8")}`;
});

const message = [
  "MANDATORY CONTEXT: this is the AegisFlow repo. Before planning or editing code,",
  "read and follow the project documents below (already loaded for you).",
  "Per AGENTS.md you must keep PROGRESS.md in sync when starting/finishing tasks,",
  "and must not violate ADR-001..ADR-007 without explicit user approval.",
  "",
  ...sections,
].join("\n\n");

process.stdout.write(
  JSON.stringify({ injectSteps: [{ systemMessage: { systemMessage: message } }] })
);
