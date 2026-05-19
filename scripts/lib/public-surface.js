const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_BLOCKED_MARKERS = [
  "stei" + "pete",
  "ele" + "na",
  "ver" + "na",
  "inspir" + "ation",
  "inspir" + "ations",
  "holo" + "cron",
  "r" + "aw/" + "ele" + "na",
  "sub" + "scriber",
  "private" + " corpus",
  "source" + " article",
  "capture" + " path",
  "proven" + "ance",
  "inter" + "nal"
];

function scanPackagedText(rootDir, options = {}) {
  const markers = options.markers || DEFAULT_BLOCKED_MARKERS;
  const files = collectTextFiles(rootDir);
  const matches = [];
  for (const file of files) {
    const fullPath = path.join(rootDir, file);
    const text = fs.readFileSync(fullPath, "utf8").toLowerCase();
    for (const marker of markers) {
      if (text.includes(marker.toLowerCase())) {
        matches.push({ file, marker: "blocked-marker" });
        break;
      }
    }
  }
  return { files, matches };
}

function collectTextFiles(dir, base = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if ([".git", ".pricebench", "node_modules"].includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTextFiles(fullPath, base));
      continue;
    }
    if (/\.(js|json|md|svg|ya?ml)$/.test(entry.name) || ["AGENTS.md", "README.md", "LICENSE"].includes(entry.name)) {
      files.push(path.relative(base, fullPath));
    }
  }
  return files;
}

module.exports = {
  DEFAULT_BLOCKED_MARKERS,
  collectTextFiles,
  scanPackagedText
};
