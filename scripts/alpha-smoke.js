#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const bin = path.join(root, "bin", "pricebench.js");
const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "pricebench-alpha-"));
const fixedModel = path.join(workdir, "fixed-agentic-research.json");
const quickstartModel = path.join(workdir, "quickstart.json");

const commands = [
  ["status", "--json"],
  ["doctor", "--json"],
  ["quickstart", quickstartModel, "--json"],
  ["demo", "ai-support"],
  ["compare", "demo:ai-support", "demo:creative-agent"],
  ["sensitivity", "demo:agentic-research", "--cost", "1,1.2", "--usage", "1,1.5"],
  ["suggest", "demo:agentic-research", "--patch", "--json"],
  ["suggest", "demo:agentic-research", "--apply", "--output", fixedModel, "--json"],
  ["analyze", fixedModel, "--json"],
  ["explain", fixedModel, "--plan", "Pro"]
];

for (const args of commands) {
  const child = spawnSync(process.execPath, [bin, ...args], {
    cwd: root,
    encoding: "utf8"
  });
  if (child.status !== 0) {
    process.stderr.write(child.stdout || "");
    process.stderr.write(child.stderr || "");
    throw new Error(`pricebench ${args.join(" ")} failed`);
  }
  process.stdout.write(`[ok] pricebench ${printableArgs(args).join(" ")}\n`);
}

const fixed = JSON.parse(fs.readFileSync(fixedModel, "utf8"));
if (fixed.schemaVersion !== "0.2") {
  throw new Error(`Expected fixed model schemaVersion 0.2, got ${fixed.schemaVersion}`);
}

process.stdout.write(`Alpha smoke OK: ${fixedModel}\n`);

function printableArgs(args) {
  return args.map((arg) => {
    if (arg === fixedModel) return "<fixed-model>";
    if (arg === quickstartModel) return "<quickstart-model>";
    return arg;
  });
}
