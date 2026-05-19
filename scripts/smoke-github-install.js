#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "pricebench-gh-install-"));
const cloneDir = path.join(workdir, "pricebench");
const binDir = path.join(workdir, "bin");
const linkedBin = path.join(binDir, "pricebench");

fs.mkdirSync(binDir, { recursive: true });
copyTree(root, cloneDir);
fs.symlinkSync(path.join(cloneDir, "bin", "pricebench.js"), linkedBin);

run(linkedBin, ["doctor", "--json"], { cwd: cloneDir });
run(linkedBin, ["quickstart", path.join(workdir, "quickstart.json"), "--json"], { cwd: cloneDir });
run(linkedBin, ["demo", "ai-support", "--json"], { cwd: cloneDir });
run(linkedBin, ["suggest", "demo:agentic-research", "--apply", "--output", path.join(workdir, "fixed.json"), "--json"], { cwd: cloneDir });
run(linkedBin, ["analyze", path.join(workdir, "fixed.json"), "--json"], { cwd: cloneDir });

process.stdout.write(`GitHub install smoke OK: ${cloneDir}\n`);

function run(command, args, options = {}) {
  const child = spawnSync(command, args, {
    cwd: options.cwd || root,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${binDir}${path.delimiter}${process.env.PATH || ""}`
    }
  });
  if (child.status !== 0) {
    process.stderr.write(child.stdout || "");
    process.stderr.write(child.stderr || "");
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
  return child.stdout;
}

function copyTree(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if ([".git", ".pricebench", "node_modules"].includes(entry.name)) continue;
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyTree(sourcePath, targetPath);
      continue;
    }
    if (entry.isSymbolicLink()) continue;
    fs.copyFileSync(sourcePath, targetPath);
    fs.chmodSync(targetPath, fs.statSync(sourcePath).mode);
  }
}
