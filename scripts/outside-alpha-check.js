#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const bin = path.join(root, "bin", "pricebench.js");
const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "pricebench-outside-"));
const quickstartModel = path.join(workdir, "quickstart.json");
const wizardModel = path.join(workdir, "pricing.json");
const wizardInput = [
  "Workflow Assistant",
  "workflow",
  "0.08",
  "0.7",
  "First completed workflow",
  "Pro",
  "99",
  "50",
  "500",
  "650",
  "0.30",
  "y"
].join("\n") + "\n";

runPricebench(["doctor"]);
runPricebench(["quickstart", quickstartModel]);
runPricebench(["init", wizardModel, "--wizard"], { input: wizardInput });
runPricebench(["suggest", wizardModel]);
runScript("run-alpha-trial.js");

process.stdout.write(`Outside alpha check OK: ${workdir}\n`);

function runPricebench(args, options = {}) {
  const child = spawnSync(process.execPath, [bin, ...args], {
    cwd: root,
    encoding: "utf8",
    input: options.input
  });
  if (child.status !== 0) fail(`pricebench ${printableArgs(args).join(" ")}`, child);
  process.stdout.write(`[ok] pricebench ${printableArgs(args).join(" ")}\n`);
}

function runScript(name) {
  const script = path.join(root, "scripts", name);
  const child = spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: "utf8"
  });
  if (child.status !== 0) fail(`node scripts/${name}`, child);
  process.stdout.write(`[ok] node scripts/${name}\n`);
}

function fail(label, child) {
  process.stderr.write(child.stdout || "");
  process.stderr.write(child.stderr || "");
  throw new Error(`${label} failed`);
}

function printableArgs(args) {
  return args.map((arg) => {
    if (arg === quickstartModel) return "<quickstart-model>";
    if (arg === wizardModel) return "<wizard-model>";
    return arg;
  });
}
