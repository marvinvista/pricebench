const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline/promises");
const {
  CURRENT_SCHEMA_VERSION,
  analyzeConfig,
  applySuggestionPatch,
  compareReports,
  explainConfig,
  lintConfig,
  PRINCIPLES,
  runSensitivity,
  suggestConfig,
  formatMoney,
  formatPercent
} = require("./core");
const { fixtures } = require("./fixtures");
const { scanPackagedText } = require("../scripts/lib/public-surface");

async function run(args, io = process) {
  const command = args[0] || "help";
  const rest = args.slice(1);

  if (command === "help" || command === "--help" || command === "-h") {
    io.stdout.write(helpText());
    return;
  }

  if (command === "analyze" || command === "bench") {
    const file = firstPositional(rest);
    if (!file) throw new Error("Usage: pricebench analyze <model.json> [--json]");
    const config = readJson(file);
    const report = analyzeConfig(config);
    writeReport(report, hasFlag(rest, "--json"), io);
    return;
  }

  if (command === "demo") {
    const name = firstPositional(rest) || "ai-support";
    const fixture = fixtures[name];
    if (!fixture) throw new Error(`Unknown demo "${name}". Available: ${Object.keys(fixtures).join(", ")}`);
    const report = analyzeConfig(fixture);
    writeReport(report, hasFlag(rest, "--json"), io);
    return;
  }

  if (command === "quickstart") {
    const output = firstPositional(rest) || "pricebench.json";
    const example = valueFor(rest, "--example") || "ai-support";
    const fixture = fixtures[example];
    if (!fixture) throw new Error(`Unknown example "${example}". Available: ${Object.keys(fixtures).join(", ")}`);
    if (fs.existsSync(output) && !hasFlag(rest, "--force")) {
      throw new Error(`${output} already exists. Use --force to overwrite.`);
    }
    const config = cloneConfig(fixture);
    fs.writeFileSync(output, `${JSON.stringify(config, null, 2)}\n`);
    const report = analyzeConfig(config);
    const suggestions = suggestConfig(config);
    writeQuickstart({
      output: path.resolve(output),
      displayOutput: output,
      suggestedOutput: fixedOutputFor(output),
      example: `demo:${example}`,
      report,
      suggestions
    }, hasFlag(rest, "--json"), io);
    return;
  }

  if (command === "compare") {
    const [leftArg, rightArg] = positionals(rest);
    if (!leftArg || !rightArg) throw new Error("Usage: pricebench compare <left.json|demo:name> <right.json|demo:name> [--json]");
    const leftSource = readConfigSource(leftArg);
    const rightSource = readConfigSource(rightArg);
    const result = compareReports(analyzeConfig(leftSource.config), analyzeConfig(rightSource.config), {
      left: leftSource.label,
      right: rightSource.label
    });
    writeCompare(result, hasFlag(rest, "--json"), io);
    return;
  }

  if (command === "sensitivity") {
    const sourceArg = firstPositional(rest);
    if (!sourceArg) throw new Error("Usage: pricebench sensitivity <model.json|demo:name> [--cost 0.8,1,1.2] [--usage 0.75,1,1.25] [--json]");
    const source = readConfigSource(sourceArg);
    const result = runSensitivity(source.config, {
      costMultipliers: parseMultipliers(valueFor(rest, "--cost"), [0.6, 0.8, 1, 1.2, 1.4]),
      usageMultipliers: parseMultipliers(valueFor(rest, "--usage"), [0.75, 1, 1.25, 1.5])
    });
    writeSensitivity({ source: source.label, ...result }, hasFlag(rest, "--json"), io);
    return;
  }

  if (command === "suggest" || command === "fix") {
    const sourceArg = firstPositional(rest);
    if (!sourceArg) throw new Error("Usage: pricebench suggest <model.json|demo:name> [--target-margin 0.7] [--patch] [--apply --output fixed.json] [--json]");
    const source = readConfigSource(sourceArg);
    const shouldApply = hasFlag(rest, "--apply");
    const output = valueFor(rest, "--output");
    if (shouldApply && !output) throw new Error("Usage: pricebench suggest <model.json|demo:name> --apply --output fixed.json [--force] [--json]");
    const result = suggestConfig(source.config, {
      targetGrossMargin: valueFor(rest, "--target-margin"),
      patch: hasFlag(rest, "--patch") || shouldApply
    });
    if (shouldApply) {
      if (fs.existsSync(output) && !hasFlag(rest, "--force")) {
        throw new Error(`${output} already exists. Use --force to overwrite.`);
      }
      const updated = applySuggestionPatch(source.config, result.patch || []);
      fs.writeFileSync(output, `${JSON.stringify(updated, null, 2)}\n`);
      writeSuggest({
        source: source.label,
        patchRequested: hasFlag(rest, "--patch"),
        applied: true,
        output: path.resolve(output),
        appliedOperations: (result.patch || []).length,
        ...result
      }, hasFlag(rest, "--json"), io);
      return;
    }
    writeSuggest({ source: source.label, patchRequested: hasFlag(rest, "--patch"), applied: false, ...result }, hasFlag(rest, "--json"), io);
    return;
  }

  if (command === "init") {
    const output = firstPositional(rest) || "pricebench.json";
    if (hasFlag(rest, "--wizard")) {
      await runWizard(output, rest, io);
      return;
    }
    const example = valueFor(rest, "--example") || "ai-support";
    const fixture = fixtures[example];
    if (!fixture) throw new Error(`Unknown example "${example}". Available: ${Object.keys(fixtures).join(", ")}`);
    if (fs.existsSync(output) && !hasFlag(rest, "--force")) {
      throw new Error(`${output} already exists. Use --force to overwrite.`);
    }
    fs.writeFileSync(output, `${JSON.stringify(fixture, null, 2)}\n`);
    io.stdout.write(`Wrote ${output}\n`);
    return;
  }

  if (command === "lint") {
    const file = firstPositional(rest);
    if (!file) throw new Error("Usage: pricebench lint <model.json> [--json]");
    const result = lintConfig(readJson(file));
    if (hasFlag(rest, "--json")) {
      io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      writeLint(result, io);
    }
    if (result.errors.length > 0) io.exitCode = 1;
    return;
  }

  if (command === "explain") {
    const sourceArg = firstPositional(rest);
    if (sourceArg) {
      const source = readConfigSource(sourceArg);
      const result = explainConfig(source.config, {
        plan: valueFor(rest, "--plan")
      });
      writeExplain({ source: source.label, ...result }, hasFlag(rest, "--json"), io);
      return;
    }
    if (hasFlag(rest, "--json")) {
      io.stdout.write(`${JSON.stringify(PRINCIPLES, null, 2)}\n`);
    } else {
      io.stdout.write(formatPrinciples());
    }
    return;
  }

  if (command === "status") {
    const status = buildStatus();
    if (hasFlag(rest, "--json")) {
      io.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
    } else {
      io.stdout.write(`pricebench ${status.version}\nDemos: ${status.demos.join(", ")}\nPrinciples: ${status.principles}\n`);
    }
    return;
  }

  if (command === "doctor") {
    const result = runDoctor(path.resolve(__dirname, ".."));
    if (hasFlag(rest, "--json")) {
      io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      io.stdout.write(formatDoctor(result));
    }
    if (result.summary.failures > 0) io.exitCode = 1;
    return;
  }

  throw new Error(`Unknown command "${command}". Run pricebench help.`);
}

function readJson(file) {
  const fullPath = path.resolve(file);
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    throw new Error(`Could not read JSON from ${file}: ${error.message}`);
  }
}

function readConfigSource(source) {
  if (source.startsWith("demo:")) {
    const name = source.slice("demo:".length);
    const fixture = fixtures[name];
    if (!fixture) throw new Error(`Unknown demo "${name}". Available: ${Object.keys(fixtures).join(", ")}`);
    return { label: `demo:${name}`, config: fixture };
  }
  if (fixtures[source] && !fs.existsSync(source)) {
    return { label: `demo:${source}`, config: fixtures[source] };
  }
  return { label: source, config: readJson(source) };
}

function cloneConfig(config) {
  return JSON.parse(JSON.stringify(config));
}

function writeReport(report, json, io) {
  if (json) {
    io.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  io.stdout.write(formatReport(report));
}

function writeCompare(result, json, io) {
  if (json) {
    io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  io.stdout.write(formatCompare(result));
}

function writeSensitivity(result, json, io) {
  if (json) {
    io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  io.stdout.write(formatSensitivity(result));
}

function writeSuggest(result, json, io) {
  if (json) {
    io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  io.stdout.write(formatSuggest(result));
}

function writeQuickstart(result, json, io) {
  if (json) {
    io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  io.stdout.write(formatQuickstart(result));
}

function writeExplain(result, json, io) {
  if (json) {
    io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  io.stdout.write(formatExplain(result));
}

function formatQuickstart(result) {
  const report = result.report;
  const suggestions = result.suggestions;
  const lines = [];
  lines.push("Pricebench quickstart");
  lines.push(`Wrote ${result.displayOutput} from ${result.example}`);
  lines.push(`Verdict: ${report.verdict}`);
  lines.push(`Overall gross margin: ${formatPercent(report.totals.grossMargin)} (target ${formatPercent(report.targetGrossMargin)})`);
  lines.push(`Suggestions: ${suggestions.summary}`);
  lines.push("");
  lines.push("Next");
  lines.push(`1. Edit ${result.displayOutput} with your real price, unit costs, included usage, average usage, and accounts.`);
  lines.push(`2. Run: node bin/pricebench.js analyze ${result.displayOutput}`);
  lines.push(`3. Run: node bin/pricebench.js suggest ${result.displayOutput}`);
  lines.push(`4. Review a patched copy: node bin/pricebench.js suggest ${result.displayOutput} --apply --output ${result.suggestedOutput}`);
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function fixedOutputFor(file) {
  const ext = path.extname(file);
  if (!ext) return `${file}.fixed.json`;
  return `${file.slice(0, -ext.length)}.fixed${ext}`;
}

function formatReport(report) {
  const lines = [];
  lines.push(`Pricebench: ${report.name}`);
  lines.push(`Verdict: ${report.verdict}`);
  lines.push(`Overall revenue: ${formatMoney(report.totals.revenue)} / ${report.period}`);
  lines.push(`Overall COGS: ${formatMoney(report.totals.cost)} / ${report.period}`);
  lines.push(`Overall gross margin: ${formatPercent(report.totals.grossMargin)} (target ${formatPercent(report.targetGrossMargin)})`);
  lines.push("");
  lines.push("Plans");
  for (const plan of report.plans) {
    lines.push(`- ${plan.name} (${plan.model}): revenue/account ${formatMoney(plan.revenuePerAccount)}, COGS/account ${formatMoney(plan.costPerAccount)}, margin ${formatPercent(plan.grossMargin)}, accounts ${plan.accounts}`);
  }
  if (report.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings");
    for (const item of report.warnings) {
      lines.push(`- [${item.severity}] ${item.scope}: ${item.message}`);
    }
  }
  if (report.suggestions.length > 0) {
    lines.push("");
    lines.push("Suggestions");
    for (const item of report.suggestions.slice(0, 6)) {
      lines.push(`- [${item.severity}] ${item.scope}: ${item.summary}`);
    }
  }
  lines.push("");
  lines.push("Next");
  report.recommendations.forEach((item, index) => {
    lines.push(`${index + 1}. ${item}`);
  });
  lines.push("");
  lines.push("Principle Lens");
  for (const principle of report.principles) {
    lines.push(`- ${principle.title}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function formatSuggest(result) {
  const lines = [];
  lines.push(`Pricebench suggest: ${result.name}`);
  lines.push(`Source: ${result.source}`);
  lines.push(`Verdict: ${result.verdict}`);
  lines.push(`Target margin: ${formatPercent(result.targetGrossMargin)}`);
  lines.push(`Summary: ${result.summary}`);
  if (result.suggestions.length > 0) {
    lines.push("");
    lines.push("Suggested changes");
    for (const item of result.suggestions) {
      lines.push(`- [${item.severity}] ${item.scope}: ${item.summary}`);
      if (item.rationale) lines.push(`  ${item.rationale}`);
    }
  }
  if (result.patchRequested) {
    lines.push("");
    lines.push(result.applied ? "JSON Patch" : "JSON Patch (dry run)");
    lines.push(JSON.stringify(result.patch || [], null, 2));
  }
  if (result.applied) {
    lines.push("");
    lines.push(`Applied ${result.appliedOperations} patch operation${result.appliedOperations === 1 ? "" : "s"}.`);
    lines.push(`Wrote ${result.output}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function formatExplain(result) {
  const lines = [];
  lines.push(`Pricebench explain: ${result.name}`);
  lines.push(`Source: ${result.source}`);
  lines.push(`Verdict: ${result.verdict}`);
  lines.push(`Overall margin: ${formatPercent(result.totals.grossMargin)} (target ${formatPercent(result.targetGrossMargin)})`);
  for (const plan of result.plans) {
    lines.push("");
    lines.push(`${plan.name} (${plan.model})`);
    lines.push(`- Revenue/account: ${plan.arithmetic.revenuePerAccount}`);
    lines.push(`- COGS/account: ${plan.arithmetic.costPerAccount}`);
    lines.push(`- Gross profit/account: ${plan.arithmetic.grossProfitPerAccount}`);
    lines.push(`- Gross margin: ${plan.arithmetic.grossMargin}`);
    if (plan.unitCosts.length > 0) {
      lines.push("- Unit costs");
      for (const entry of plan.unitCosts) lines.push(`  - ${entry.unit}: ${entry.formula}`);
    }
    if (plan.overages.some((entry) => entry.revenue > 0)) {
      lines.push("- Overage revenue");
      for (const entry of plan.overages.filter((item) => item.revenue > 0)) lines.push(`  - ${entry.unit}: ${entry.formula}`);
    }
    if (plan.usageScenarios.length > 0) {
      lines.push("- Usage percentiles");
      for (const scenario of plan.usageScenarios) {
        lines.push(`  - ${scenario.label.toUpperCase()}: revenue/account ${formatMoney(scenario.revenuePerAccount)}, COGS/account ${formatMoney(scenario.costPerAccount)}, margin ${formatPercent(scenario.grossMargin)}`);
      }
    }
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function formatCompare(result) {
  const lines = [];
  lines.push("Pricebench compare");
  lines.push(`Left: ${result.left.label} (${result.left.verdict}, margin ${formatPercent(result.left.grossMargin)}, warnings ${result.left.warningCount})`);
  lines.push(`Right: ${result.right.label} (${result.right.verdict}, margin ${formatPercent(result.right.grossMargin)}, warnings ${result.right.warningCount})`);
  lines.push(`Winner: ${result.winner}`);
  lines.push("");
  lines.push("Delta");
  lines.push(`- Revenue: ${formatSignedMoney(result.delta.revenue)}`);
  lines.push(`- COGS: ${formatSignedMoney(result.delta.cost)}`);
  lines.push(`- Gross profit: ${formatSignedMoney(result.delta.grossProfit)}`);
  lines.push(`- Gross margin: ${formatSignedPercent(result.delta.grossMargin)}`);
  lines.push(`- Warnings: ${formatSignedNumber(result.delta.warnings)} total, ${formatSignedNumber(result.delta.highWarnings)} high`);
  lines.push("");
  lines.push("Notes");
  for (const note of result.notes) lines.push(`- ${note}`);
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function formatSensitivity(result) {
  const lines = [];
  lines.push(`Pricebench sensitivity: ${result.name}`);
  lines.push(`Source: ${result.source}`);
  lines.push(`Baseline: ${result.baseline.verdict}, margin ${formatPercent(result.baseline.grossMargin)}, warnings ${result.baseline.warningCount}`);
  lines.push("");
  lines.push("Scenarios");
  for (const scenario of result.scenarios) {
    lines.push(`- cost x${scenario.costMultiplier} / usage x${scenario.usageMultiplier}: ${scenario.verdict}, margin ${formatPercent(scenario.grossMargin)}, warnings ${scenario.warningCount}`);
  }
  const riskCases = result.scenarios.filter((scenario) => scenario.verdict !== "ship");
  if (riskCases.length > 0) {
    lines.push("");
    lines.push("Risk Cases");
    for (const scenario of riskCases.slice(0, 8)) {
      lines.push(`- cost x${scenario.costMultiplier} / usage x${scenario.usageMultiplier}: ${scenario.verdict} (${scenario.highWarningCount} high warnings)`);
    }
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function writeLint(result, io) {
  if (result.errors.length === 0 && result.warnings.length === 0) {
    io.stdout.write("OK\n");
    return;
  }
  for (const error of result.errors) io.stdout.write(`error: ${error}\n`);
  for (const warning of result.warnings) io.stdout.write(`warning: ${warning}\n`);
}

function formatPrinciples() {
  const lines = ["Pricebench principles"];
  for (const principle of PRINCIPLES) {
    lines.push(`- ${principle.title}: ${principle.detail}`);
  }
  return `${lines.join("\n")}\n`;
}

function buildStatus() {
  const packageJson = require("../package.json");
  return {
    name: packageJson.name,
    version: packageJson.version,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    demos: Object.keys(fixtures),
    schema: "schema/pricebench.schema.json",
    principles: PRINCIPLES.length,
    commands: ["quickstart", "analyze", "bench", "compare", "demo", "init", "lint", "sensitivity", "suggest", "explain", "doctor", "status"]
  };
}

function firstPositional(args) {
  return positionals(args)[0];
}

function positionals(args) {
  const result = [];
  const valueFlags = new Set(["--cost", "--example", "--output", "--plan", "--target-margin", "--usage"]);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (valueFlags.has(arg)) {
      index += 1;
      continue;
    }
    if (!arg.startsWith("-")) result.push(arg);
  }
  return result;
}

function hasFlag(args, flag) {
  return args.includes(flag);
}

function valueFor(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  return args[index + 1];
}

function parseMultipliers(value, fallback) {
  if (!value) return fallback;
  const parsed = value.split(",").map((item) => Number(item.trim())).filter((item) => Number.isFinite(item) && item > 0);
  if (parsed.length === 0) throw new Error(`Invalid multiplier list "${value}"`);
  return parsed;
}

async function runWizard(output, args, io) {
  if (fs.existsSync(output) && !hasFlag(args, "--force")) {
    throw new Error(`${output} already exists. Use --force to overwrite.`);
  }
  const input = io.stdin || process.stdin;
  const outputStream = io.stdout || process.stdout;
  const scriptedAnswers = input.isTTY ? undefined : (await readAll(input)).split(/\r?\n/);
  const rl = scriptedAnswers ? undefined : readline.createInterface({ input, output: outputStream });
  const ask = async (question, fallback) => {
    const suffix = fallback === undefined ? "" : ` (${fallback})`;
    if (scriptedAnswers) {
      const answer = (scriptedAnswers.shift() || "").trim();
      return answer === "" ? fallback : answer;
    }
    const answer = (await rl.question(`${question}${suffix}: `)).trim();
    return answer === "" ? fallback : answer;
  };
  try {
    const name = await ask("Product name", "My AI product");
    const unit = normalizeUnit(await ask("Primary usage unit", "task"));
    const unitCost = positiveNumber(await ask(`Cost per ${unit}`, "0.05"), 0.05);
    const targetGrossMargin = clampWizardMargin(positiveNumber(await ask("Target gross margin", "0.7"), 0.7));
    const activationMoment = await ask("Activation moment", "First successful AI task");
    const planName = await ask("Paid plan name", "Pro");
    const price = positiveNumber(await ask("Monthly price", "49"), 49);
    const accounts = positiveNumber(await ask("Expected accounts", "100"), 100);
    const included = positiveNumber(await ask(`Included ${unit} per account`, "1000"), 1000);
    const averageUsage = positiveNumber(await ask(`Average ${unit} per account`, String(Math.ceil(included * 1.2))), Math.ceil(included * 1.2));
    const overageDefault = String(Math.max(0.01, Math.ceil((unitCost / Math.max(0.01, 1 - targetGrossMargin)) * 100) / 100));
    const overage = positiveNumber(await ask(`Overage price per ${unit}`, overageDefault), Number(overageDefault));
    const includeFree = /^y/i.test(await ask("Add a free plan? y/N", "N"));

    const config = buildWizardConfig({
      name,
      unit,
      unitCost,
      targetGrossMargin,
      activationMoment,
      planName,
      price,
      accounts,
      included,
      averageUsage,
      overage,
      includeFree
    });
    fs.writeFileSync(output, `${JSON.stringify(config, null, 2)}\n`);
    outputStream.write(`Wrote ${output}\nNext: pricebench analyze ${output}\nThen: pricebench suggest ${output}\n`);
  } finally {
    if (rl) rl.close();
  }
}

function buildWizardConfig(input) {
  const plans = [];
  if (input.includeFree) {
    plans.push({
      name: "Free",
      model: "freemium",
      price: 0,
      accounts: Math.max(1, Math.round(input.accounts * 4)),
      included: { [input.unit]: Math.max(1, Math.round(input.included * 0.05)) },
      averageUsage: { [input.unit]: Math.max(1, Math.round(input.included * 0.025)) }
    });
  }
  plans.push({
    name: input.planName,
    model: "hybrid",
    price: input.price,
    accounts: input.accounts,
    included: { [input.unit]: input.included },
    overage: { [input.unit]: input.overage },
    averageUsage: { [input.unit]: input.averageUsage }
  });
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    name: input.name,
    currency: "USD",
    period: "month",
    assumptions: {
      targetGrossMargin: input.targetGrossMargin,
      freeMarketingBudgetPerAccount: 2,
      activationMoment: input.activationMoment,
      pricingOwner: "owner",
      billingReadiness: "draft"
    },
    unitCosts: [
      { unit: input.unit, cost: input.unitCost }
    ],
    plans
  };
}

function normalizeUnit(value) {
  return String(value || "task").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "task";
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function clampWizardMargin(value) {
  if (value > 1) return value / 100;
  if (value < 0) return 0;
  return value;
}

async function readAll(stream) {
  let text = "";
  for await (const chunk of stream) {
    text += chunk;
  }
  return text;
}

function formatSignedMoney(value) {
  return `${value >= 0 ? "+" : ""}${formatMoney(value)}`;
}

function formatSignedPercent(value) {
  return `${value >= 0 ? "+" : ""}${formatPercent(value)}`;
}

function formatSignedNumber(value) {
  return `${value >= 0 ? "+" : ""}${value}`;
}

function helpText() {
  return `pricebench

Usage:
  pricebench quickstart [pricebench.json] [--example ai-support] [--force] [--json]
  pricebench demo [ai-support|creative-agent|agentic-research] [--json]
  pricebench analyze <model.json> [--json]
  pricebench bench <model.json> [--json]
  pricebench compare <left.json|demo:name> <right.json|demo:name> [--json]
  pricebench sensitivity <model.json|demo:name> [--cost 0.8,1,1.2] [--usage 0.75,1,1.25] [--json]
  pricebench suggest <model.json|demo:name> [--target-margin 0.7] [--patch] [--apply --output fixed.json] [--json]
  pricebench init [pricebench.json] [--example ai-support] [--wizard] [--force]
  pricebench lint <model.json> [--json]
  pricebench explain [model.json|demo:name] [--plan Pro] [--json]
  pricebench doctor [--json]
  pricebench status [--json]

Model fields:
  unitCosts[]       AI cost by usage unit, e.g. resolution, render, token_pack.
  plans[]           Price, included usage, average usage, overages, accounts.
  usagePercentiles  Optional p50/p90/p99 usage records for tail-risk modeling.
  assumptions       Target margin, free usage budget, activation moment, billing readiness.

`;
}

function runDoctor(rootDir) {
  const checks = [];
  const add = (id, ok, message, details = {}) => checks.push({ id, ok, message, ...details });
  const packageFile = path.join(rootDir, "package.json");
  const schemaFile = path.join(rootDir, "schema", "pricebench.schema.json");
  let packageJson;
  let schemaJson;

  add("node-version", Number(process.versions.node.split(".")[0]) >= 20, `Node ${process.versions.node}; Pricebench requires Node 20 or newer.`);

  try {
    packageJson = JSON.parse(fs.readFileSync(packageFile, "utf8"));
    add("package-json", packageJson.name === "@marvinvista/pricebench" && Boolean(packageJson.bin && packageJson.bin.pricebench), "Package metadata and binary entry are present.");
  } catch (error) {
    add("package-json", false, `Could not read package.json: ${error.message}`);
  }

  try {
    schemaJson = JSON.parse(fs.readFileSync(schemaFile, "utf8"));
    add("schema-file", Boolean(schemaJson.properties && schemaJson.properties.schemaVersion), `Schema file exists and declares schemaVersion ${CURRENT_SCHEMA_VERSION}.`);
  } catch (error) {
    add("schema-file", false, `Could not read schema file: ${error.message}`);
  }

  const requiredDocs = [
    "ALPHA.md",
    "README.md",
    "docs/github-install.md",
    "docs/alpha-findings.md",
    "docs/pricing-principles.md",
    "docs/release.md",
    "docs/package-contents.md",
    "SECURITY.md",
    "ROADMAP.md"
  ];
  const missingDocs = requiredDocs.filter((file) => !fs.existsSync(path.join(rootDir, file)));
  add("docs", missingDocs.length === 0, missingDocs.length === 0 ? "Required docs are present." : `Missing docs: ${missingDocs.join(", ")}`);

  const fixtureResults = Object.entries(fixtures).map(([name, config]) => {
    try {
      const lint = lintConfig(config);
      if (lint.errors.length > 0) return { name, ok: false, error: lint.errors.join("; ") };
      const report = analyzeConfig(config);
      return { name, ok: true, verdict: report.verdict };
    } catch (error) {
      return { name, ok: false, error: error.message };
    }
  });
  add("fixtures", fixtureResults.every((item) => item.ok), `${fixtureResults.length} demo fixtures analyze.`, { fixtures: fixtureResults });

  const exampleDir = path.join(rootDir, "examples");
  const exampleFiles = fs.existsSync(exampleDir) ? fs.readdirSync(exampleDir).filter((file) => file.endsWith(".json")).sort() : [];
  const exampleResults = exampleFiles.map((file) => {
    try {
      const config = JSON.parse(fs.readFileSync(path.join(exampleDir, file), "utf8"));
      const lint = lintConfig(config);
      if (lint.errors.length > 0) return { file, ok: false, error: lint.errors.join("; ") };
      return { file, ok: true, verdict: analyzeConfig(config).verdict };
    } catch (error) {
      return { file, ok: false, error: error.message };
    }
  });
  add("examples", exampleFiles.length > 0 && exampleResults.every((item) => item.ok), `${exampleResults.length} example model files analyze.`, { examples: exampleResults });

  const alphaDir = path.join(rootDir, "alpha", "models");
  const alphaFiles = fs.existsSync(alphaDir) ? fs.readdirSync(alphaDir).filter((file) => file.endsWith(".json")).sort() : [];
  const alphaResults = alphaFiles.map((file) => {
    try {
      const config = JSON.parse(fs.readFileSync(path.join(alphaDir, file), "utf8"));
      const lint = lintConfig(config);
      if (lint.errors.length > 0) return { file, ok: false, error: lint.errors.join("; ") };
      return { file, ok: true, verdict: analyzeConfig(config).verdict };
    } catch (error) {
      return { file, ok: false, error: error.message };
    }
  });
  add("alpha-models", alphaFiles.length >= 5 && alphaResults.every((item) => item.ok), `${alphaResults.length} alpha model files analyze.`, { alphaModels: alphaResults });

  const scan = scanPackagedText(rootDir);
  add("public-surface", scan.matches.length === 0, scan.matches.length === 0 ? "Packaged text has no blocked release markers." : `${scan.matches.length} blocked marker match${scan.matches.length === 1 ? "" : "es"} found.`, { matches: scan.matches });

  const failures = checks.filter((item) => !item.ok).length;
  return {
    name: "pricebench doctor",
    version: packageJson && packageJson.version,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    summary: {
      checks: checks.length,
      failures
    },
    checks
  };
}

function formatDoctor(result) {
  const lines = [];
  lines.push(`Pricebench doctor ${result.version || ""}`.trim());
  lines.push(`Schema version: ${result.schemaVersion}`);
  for (const check of result.checks) {
    lines.push(`${check.ok ? "OK" : "FAIL"} ${check.id}: ${check.message}`);
  }
  lines.push("");
  lines.push(result.summary.failures === 0 ? "Ready for release-candidate checks." : `${result.summary.failures} check${result.summary.failures === 1 ? "" : "s"} failed.`);
  lines.push("");
  return `${lines.join("\n")}\n`;
}

module.exports = {
  run,
  formatCompare,
  formatDoctor,
  formatExplain,
  formatReport,
  formatSensitivity,
  formatSuggest,
  helpText,
  runDoctor
};
