#!/usr/bin/env node

const path = require("node:path");
const { scanPackagedText } = require("./lib/public-surface");

const root = path.resolve(__dirname, "..");
const json = process.argv.includes("--json");
const result = scanPackagedText(root);
const output = {
  ok: result.matches.length === 0,
  filesScanned: result.files.length,
  matches: result.matches
};

if (json) {
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
} else if (output.ok) {
  process.stdout.write(`Public surface OK: ${output.filesScanned} files scanned.\n`);
} else {
  process.stderr.write(`Public surface check failed: ${output.matches.length} match${output.matches.length === 1 ? "" : "es"}.\n`);
  for (const match of output.matches) {
    process.stderr.write(`- ${match.file}: ${match.marker}\n`);
  }
}

if (!output.ok) process.exitCode = 1;
