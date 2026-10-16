// PostToolUse: after a file edit, run typecheck / related tests / prisma generate.
// Results are saved to .agents/.last-check.txt and surfaced to the agent by reminder.js.
const fs = require("fs");
const { CHECK_FILE, readInput, respond, getWriteTarget, run } = require("./lib");

const SOURCE_FILE = /\.(ts|tsx)$/;
const TIMEOUT_MS = 90000;

function check() {
  const { toolCall } = readInput();
  const target = getWriteTarget(toolCall);
  if (!target) return null;
  const { file } = target;
  const report = [];

  if (file === "prisma/schema.prisma") {
    const gen = run("npx", ["prisma", "generate"], TIMEOUT_MS);
    if (!gen.ok) report.push(`prisma generate FAILED:\n${gen.output}`);
  }

  if (SOURCE_FILE.test(file)) {
    const tsc = run("npx", ["tsc", "--noEmit"], TIMEOUT_MS);
    if (!tsc.ok) report.push(`tsc --noEmit FAILED after editing ${file}:\n${tsc.output}`);

    const tests = run("npx", ["vitest", "related", "--run", "--passWithNoTests", file], TIMEOUT_MS);
    if (!tests.ok) report.push(`vitest related to ${file} FAILED:\n${tests.output}`);
  }

  return report.length ? report.join("\n\n") : null;
}

const failure = check();
if (failure) fs.writeFileSync(CHECK_FILE, failure.slice(0, 6000));
respond({});
