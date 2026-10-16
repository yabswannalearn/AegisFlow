// Stop hook: blocks finishing if source changed without a PROGRESS.md update, or if tests fail.
const { readInput, respond, run } = require("./lib");

const MAX_FORCED_CONTINUES = 2; // avoid infinite loops if the agent cannot satisfy a check
const SOURCE_DIRS = /^(src|prisma|n8n)\//;
const TIMEOUT_MS = 120000;

const input = readInput();

function reasons() {
  const list = [];

  const status = run("git", ["status", "--porcelain"], 15000).output;
  const changed = status
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => l.slice(3).replace(/\\/g, "/"));
  const sourceChanged = changed.some((f) => SOURCE_DIRS.test(f));
  const progressChanged = changed.includes("PROGRESS.md");
  if (sourceChanged && !progressChanged) {
    list.push("Source files changed but PROGRESS.md was not updated. Update the Kanban board, phase table and changelog per AGENTS.md section 2.");
  }

  if (sourceChanged) {
    const tests = run("npm", ["test", "--silent"], TIMEOUT_MS);
    if (!tests.ok) list.push(`npm test is failing:\n${tests.output.slice(-3000)}`);
  }

  return list;
}

if (input.terminationReason !== "NO_TOOL_CALL" || (input.executionNum || 1) > MAX_FORCED_CONTINUES) {
  respond({});
} else {
  const problems = reasons();
  respond(problems.length ? { decision: "continue", reason: problems.join("\n\n") } : {});
}
