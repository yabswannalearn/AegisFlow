// Shared helpers for AegisFlow agent hooks.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const CHECK_FILE = path.join(__dirname, "..", ".last-check.txt");

function readInput() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
}

function respond(obj) {
  process.stdout.write(JSON.stringify(obj));
}

// Returns { file (relative, forward slashes), content } for a file-writing tool call.
function getWriteTarget(toolCall) {
  const args = (toolCall && toolCall.args) || {};
  const target = args.TargetFile;
  if (!target) return null;
  return {
    file: path.relative(ROOT, target).replace(/\\/g, "/"),
    content: args.CodeContent || args.ReplacementContent || "",
  };
}

// Runs a command in the project root; returns { ok, output }.
function run(cmd, args, timeoutMs) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", shell: true, timeout: timeoutMs });
  return { ok: res.status === 0, output: `${res.stdout || ""}${res.stderr || ""}`.trim() };
}

module.exports = { ROOT, CHECK_FILE, readInput, respond, getWriteTarget, run };
