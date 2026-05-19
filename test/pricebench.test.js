const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { CURRENT_SCHEMA_VERSION, analyzeConfig, applySuggestionPatch, compareReports, explainConfig, lintConfig, runSensitivity, suggestConfig } = require("../src/core");
const { fixtures } = require("../src/fixtures");
const { scanPackagedText } = require("../scripts/lib/public-surface");

const root = path.resolve(__dirname, "..");
const bin = path.join(root, "bin", "pricebench.js");

test("analyzes a hybrid and outcome pricing model", () => {
  const report = analyzeConfig(fixtures["ai-support"]);
  assert.equal(report.name, "AI support desk");
  assert.equal(report.plans.length, 3);
  assert.equal(report.verdict, "ship");
  assert.ok(report.totals.revenue > report.totals.cost);
  assert.ok(report.principles.some((item) => item.id === "ai-cogs"));
});

test("dogfood demos cover ship watch and revise verdicts", () => {
  assert.equal(analyzeConfig(fixtures["ai-support"]).verdict, "ship");
  assert.equal(analyzeConfig(fixtures["creative-agent"]).verdict, "watch");
  assert.equal(analyzeConfig(fixtures["agentic-research"]).verdict, "revise");
});

test("all dogfood fixtures analyze", () => {
  const names = Object.keys(fixtures);
  assert.ok(names.length >= 8);
  for (const name of names) {
    assert.equal(fixtures[name].schemaVersion, CURRENT_SCHEMA_VERSION, name);
    const report = analyzeConfig(fixtures[name]);
    assert.ok(["ship", "watch", "revise"].includes(report.verdict), name);
    assert.equal(typeof report.totals.grossMargin, "number", name);
  }
});

test("flags missing unit costs", () => {
  const config = {
    plans: [
      {
        name: "Pro",
        price: 20,
        accounts: 10,
        averageUsage: { token_pack: 100 }
      }
    ]
  };
  const report = analyzeConfig(config);
  assert.equal(report.verdict, "revise");
  assert.ok(report.warnings.some((item) => item.message.includes("no unit cost")));
});

test("lint catches missing plans", () => {
  const result = lintConfig({ name: "bad" });
  assert.ok(result.errors.includes('missing required field "plans"'));
});

test("lint catches malformed schema fields", () => {
  const result = lintConfig({
    schemaVersion: "9.9",
    unitCosts: [{ unit: "token", cost: -1 }],
    plans: [{ name: "Pro", model: "magic", price: "free", averageUsage: { token: "lots" } }]
  });
  assert.ok(result.errors.some((item) => item.includes("schemaVersion")));
  assert.ok(result.errors.some((item) => item.includes("unitCosts[0].cost")));
  assert.ok(result.errors.some((item) => item.includes('unknown model "magic"')));
  assert.ok(result.errors.some((item) => item.includes("Pro.price")));
  assert.ok(result.errors.some((item) => item.includes("Pro.averageUsage.token")));
});

test("compares two pricing models", () => {
  const result = compareReports(analyzeConfig(fixtures["ai-support"]), analyzeConfig(fixtures["creative-agent"]), {
    left: "demo:ai-support",
    right: "demo:creative-agent"
  });
  assert.equal(result.left.verdict, "ship");
  assert.equal(result.right.verdict, "watch");
  assert.equal(result.winner, "demo:ai-support");
  assert.ok(result.notes.length > 0);
});

test("runs sensitivity grid", () => {
  const result = runSensitivity(fixtures["agentic-research"], {
    costMultipliers: [0.8, 1.2],
    usageMultipliers: [1, 1.5]
  });
  assert.equal(result.scenarios.length, 4);
  assert.ok(result.scenarios.every((scenario) => scenario.verdict === "revise"));
});

test("suggests concrete pricing changes", () => {
  const result = suggestConfig(fixtures["agentic-research"]);
  assert.equal(result.verdict, "revise");
  assert.ok(result.suggestions.length > 0);
  assert.ok(result.suggestions.some((item) => item.type === "raise-price"));
  assert.ok(result.suggestions.some((item) => item.type === "add-overage"));
});

test("models usage percentiles as tail-risk scenarios", () => {
  const report = analyzeConfig(fixtures["agentic-research"]);
  const pro = report.plans.find((plan) => plan.name === "Pro");
  assert.equal(pro.usageScenarios.length, 3);
  assert.ok(pro.usageScenarios.some((scenario) => scenario.label === "p99" && scenario.belowTarget));
  assert.ok(report.warnings.some((item) => item.message.includes("P99 usage margin")));
});

test("explains plan arithmetic", () => {
  const result = explainConfig(fixtures["agentic-research"], { plan: "Pro" });
  assert.equal(result.plans.length, 1);
  assert.equal(result.plans[0].name, "Pro");
  assert.match(result.plans[0].arithmetic.revenuePerAccount, /\$49\.00 base/);
  assert.ok(result.plans[0].unitCosts.some((entry) => entry.unit === "research_run"));
});

test("suggestions can emit dry-run json patch operations", () => {
  const result = suggestConfig(fixtures["agentic-research"], { patch: true });
  assert.ok(Array.isArray(result.patch));
  assert.ok(result.patch.some((operation) => operation.path === "/plans/0/price"));
  assert.ok(result.patch.some((operation) => operation.path.includes("/overage/research_run")));
});

test("suggestion patches can be applied to a config", () => {
  const result = suggestConfig(fixtures["agentic-research"], { patch: true });
  const fixed = applySuggestionPatch(fixtures["agentic-research"], result.patch);
  assert.equal(fixed.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(fixed.plans[0].price, 270);
  assert.equal(fixed.plans[0].overage.research_run, 7);
  assert.equal(fixed.plans[1].finiteWorkload, true);
  assert.doesNotThrow(() => analyzeConfig(fixed));
});

test("cli demo emits json", () => {
  const child = spawnSync(process.execPath, [bin, "demo", "ai-support", "--json"], {
    encoding: "utf8"
  });
  assert.equal(child.status, 0, child.stderr);
  const parsed = JSON.parse(child.stdout);
  assert.equal(parsed.name, "AI support desk");
  assert.equal(parsed.verdict, "ship");
});

test("cli quickstart writes an analyzable starter model", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pricebench-quickstart-"));
  const output = path.join(tmp, "pricing.json");
  const child = spawnSync(process.execPath, [bin, "quickstart", output, "--json"], {
    encoding: "utf8"
  });
  assert.equal(child.status, 0, child.stderr);
  const parsed = JSON.parse(child.stdout);
  assert.equal(parsed.output, output);
  assert.equal(parsed.example, "demo:ai-support");
  assert.equal(parsed.report.verdict, "ship");
  assert.match(parsed.suggestions.summary, /No pricing changes/);
  const config = JSON.parse(fs.readFileSync(output, "utf8"));
  assert.equal(config.name, "AI support desk");
  assert.equal(analyzeConfig(config).verdict, "ship");
});

test("cli suggest emits json", () => {
  const child = spawnSync(process.execPath, [bin, "suggest", "demo:agentic-research", "--json"], {
    encoding: "utf8"
  });
  assert.equal(child.status, 0, child.stderr);
  const parsed = JSON.parse(child.stdout);
  assert.equal(parsed.source, "demo:agentic-research");
  assert.ok(parsed.suggestions.length > 0);
});

test("cli suggest emits dry-run patch", () => {
  const child = spawnSync(process.execPath, [bin, "suggest", "demo:agentic-research", "--patch", "--json"], {
    encoding: "utf8"
  });
  assert.equal(child.status, 0, child.stderr);
  const parsed = JSON.parse(child.stdout);
  assert.ok(Array.isArray(parsed.patch));
  assert.ok(parsed.patch.length > 0);
});

test("cli suggest applies patch to an output file", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pricebench-apply-"));
  const output = path.join(tmp, "fixed.json");
  const child = spawnSync(process.execPath, [bin, "suggest", "demo:agentic-research", "--apply", "--output", output, "--json"], {
    encoding: "utf8"
  });
  assert.equal(child.status, 0, child.stderr);
  const parsed = JSON.parse(child.stdout);
  assert.equal(parsed.applied, true);
  assert.equal(parsed.output, output);
  const fixed = JSON.parse(fs.readFileSync(output, "utf8"));
  assert.equal(fixed.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(fixed.plans[0].price, 270);
  assert.doesNotThrow(() => analyzeConfig(fixed));
});

test("cli explain emits json", () => {
  const child = spawnSync(process.execPath, [bin, "explain", "demo:agentic-research", "--plan", "Pro", "--json"], {
    encoding: "utf8"
  });
  assert.equal(child.status, 0, child.stderr);
  const parsed = JSON.parse(child.stdout);
  assert.equal(parsed.plans[0].name, "Pro");
  assert.ok(parsed.plans[0].usageScenarios.some((scenario) => scenario.label === "p90"));
});

test("cli wizard init writes an analyzable model", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pricebench-wizard-"));
  const output = path.join(tmp, "pricing.json");
  const input = [
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
  const child = spawnSync(process.execPath, [bin, "init", output, "--wizard"], {
    encoding: "utf8",
    input
  });
  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, /Wrote/);
  const config = JSON.parse(fs.readFileSync(output, "utf8"));
  const report = analyzeConfig(config);
  assert.equal(report.name, "Workflow Assistant");
  assert.ok(report.plans.length >= 1);
});

test("cli compare emits json", () => {
  const child = spawnSync(process.execPath, [bin, "compare", "demo:ai-support", "demo:creative-agent", "--json"], {
    encoding: "utf8"
  });
  assert.equal(child.status, 0, child.stderr);
  const parsed = JSON.parse(child.stdout);
  assert.equal(parsed.left.label, "demo:ai-support");
  assert.equal(parsed.right.label, "demo:creative-agent");
  assert.equal(parsed.winner, "demo:ai-support");
});

test("cli doctor passes in this repo", () => {
  const child = spawnSync(process.execPath, [bin, "doctor", "--json"], {
    encoding: "utf8"
  });
  assert.equal(child.status, 0, child.stderr);
  const parsed = JSON.parse(child.stdout);
  assert.equal(parsed.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(parsed.summary.failures, 0);
  assert.ok(parsed.checks.some((item) => item.id === "public-surface" && item.ok));
  assert.ok(parsed.checks.some((item) => item.id === "alpha-models" && item.ok));
});

test("cli status lists the shortest start command", () => {
  const child = spawnSync(process.execPath, [bin, "status", "--json"], {
    encoding: "utf8"
  });
  assert.equal(child.status, 0, child.stderr);
  const parsed = JSON.parse(child.stdout);
  assert.ok(parsed.commands.includes("quickstart"));
});

test("alpha trial script covers five pricing models", () => {
  const child = spawnSync(process.execPath, [path.join(root, "scripts", "run-alpha-trial.js"), "--json"], {
    encoding: "utf8"
  });
  assert.equal(child.status, 0, child.stderr);
  const parsed = JSON.parse(child.stdout);
  assert.equal(parsed.modelCount, 5);
  assert.ok(parsed.models.every((model) => model.errors.length === 0));
  assert.ok(parsed.findings.some((finding) => finding.note.includes("Tail-risk")));
});

test("outside alpha check exercises the tester path", () => {
  const child = spawnSync(process.execPath, [path.join(root, "scripts", "outside-alpha-check.js")], {
    encoding: "utf8"
  });
  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, /\[ok\] pricebench doctor/);
  assert.match(child.stdout, /\[ok\] pricebench quickstart/);
  assert.match(child.stdout, /Outside alpha check OK/);
});

test("public surface script passes", () => {
  const child = spawnSync(process.execPath, [path.join(root, "scripts", "verify-public-surface.js"), "--json"], {
    encoding: "utf8"
  });
  assert.equal(child.status, 0, child.stderr);
  const parsed = JSON.parse(child.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.matches.length, 0);
});

test("golden command snapshots stay stable", () => {
  assertSnapshot("demo-ai-support.txt", ["demo", "ai-support"]);
  assertSnapshot("suggest-agentic-research.txt", ["suggest", "demo:agentic-research"]);
  assertSnapshot("explain-agentic-research-pro.txt", ["explain", "demo:agentic-research", "--plan", "Pro"]);
  assertSnapshot("compare-ai-support-creative-agent.txt", ["compare", "demo:ai-support", "demo:creative-agent"]);
  assertSnapshot("sensitivity-agentic-research.txt", ["sensitivity", "demo:agentic-research", "--cost", "1", "--usage", "1"]);
});

test("cli sensitivity emits json", () => {
  const child = spawnSync(process.execPath, [bin, "sensitivity", "demo:agentic-research", "--cost", "1,1.2", "--usage", "1,1.5", "--json"], {
    encoding: "utf8"
  });
  assert.equal(child.status, 0, child.stderr);
  const parsed = JSON.parse(child.stdout);
  assert.equal(parsed.source, "demo:agentic-research");
  assert.equal(parsed.scenarios.length, 4);
});

test("cli lint returns non-zero for invalid config", () => {
  const child = spawnSync(process.execPath, [bin, "lint", path.join(root, "package.json")], {
    encoding: "utf8"
  });
  assert.equal(child.status, 1);
  assert.match(child.stdout, /missing required field/);
});

test("repository metadata is ready for GitHub release", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.equal(packageJson.bin.pricebench, "./bin/pricebench.js");
  assert.equal(packageJson.repository.type, "git");
  assert.match(packageJson.repository.url, /github\.com\/marvinvista\/pricebench/);
  assert.match(packageJson.bugs.url, /github\.com\/marvinvista\/pricebench\/issues/);
  assert.ok(packageJson.exports["./core"]);
  assert.equal(packageJson.scripts["github:smoke"], "node scripts/smoke-github-install.js");
  assert.equal(packageJson.scripts["alpha:outside"], "node scripts/outside-alpha-check.js");
  assert.equal(packageJson.scripts["public:surface"], "node scripts/verify-public-surface.js");
  assert.equal(Object.prototype.hasOwnProperty.call(packageJson.scripts, "smoke:tarball"), false);
  assert.ok(packageJson.files.includes("alpha"));
  assert.ok(packageJson.files.includes("ALPHA.md"));
  assert.ok(packageJson.files.includes("ROADMAP.md"));
  assert.ok(packageJson.files.includes("SECURITY.md"));
});

test("principle sources are public safe", () => {
  const report = analyzeConfig(fixtures["ai-support"]);
  const serialized = JSON.stringify(report.principles);
  for (const marker of ["r" + "aw/" + "ele" + "na", "sub" + "scriber", "Holo" + "cron", "Ele" + "na"]) {
    assert.equal(serialized.includes(marker), false);
  }
});

test("packaged text avoids non-product background markers", () => {
  const result = scanPackagedText(root);
  assert.equal(result.matches.length, 0, JSON.stringify(result.matches));
  assert.ok(result.files.includes("README.md"));
});

function assertSnapshot(name, args) {
  const child = spawnSync(process.execPath, [bin, ...args], {
    encoding: "utf8"
  });
  assert.equal(child.status, 0, child.stderr);
  const expected = fs.readFileSync(path.join(root, "test", "snapshots", name), "utf8");
  assert.equal(child.stdout.replace(/\r\n/g, "\n"), expected.replace(/\r\n/g, "\n"));
}
