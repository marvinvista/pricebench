#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const {
  analyzeConfig,
  applySuggestionPatch,
  lintConfig,
  suggestConfig,
  formatPercent
} = require("../src/core");

const root = path.resolve(__dirname, "..");
const modelDir = path.join(root, "alpha", "models");

function main(argv) {
  const json = argv.includes("--json");
  const output = valueFor(argv, "--output");
  const files = fs.readdirSync(modelDir)
    .filter((file) => file.endsWith(".json"))
    .sort();
  const models = files.map((file) => runModel(path.join(modelDir, file)));
  const findings = summarizeFindings(models);
  const result = {
    name: "Pricebench alpha trial",
    modelCount: models.length,
    models,
    findings
  };

  if (output) {
    fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
  }

  process.stdout.write(json ? `${JSON.stringify(result, null, 2)}\n` : formatTrial(result));
  if (models.some((model) => model.errors.length > 0)) {
    process.exitCode = 1;
  }
}

function runModel(file) {
  const config = JSON.parse(fs.readFileSync(file, "utf8"));
  const lint = lintConfig(config);
  if (lint.errors.length > 0) {
    return {
      file: path.relative(root, file),
      name: config.name || path.basename(file, ".json"),
      errors: lint.errors,
      warnings: lint.warnings
    };
  }

  const report = analyzeConfig(config);
  const suggestionResult = suggestConfig(config, { patch: true });
  const fixed = applySuggestionPatch(config, suggestionResult.patch || []);
  const fixedReport = analyzeConfig(fixed);
  const notes = frictionNotes({ config, report, fixedReport, suggestions: suggestionResult.suggestions });

  return {
    file: path.relative(root, file),
    name: report.name,
    errors: [],
    verdict: report.verdict,
    grossMargin: report.totals.grossMargin,
    warnings: report.warnings.length,
    highWarnings: report.warnings.filter((warning) => warning.severity === "high").length,
    suggestions: suggestionResult.suggestions.length,
    patchOperations: (suggestionResult.patch || []).length,
    fixedVerdict: fixedReport.verdict,
    fixedGrossMargin: fixedReport.totals.grossMargin,
    fixedWarnings: fixedReport.warnings.length,
    fixedHighWarnings: fixedReport.warnings.filter((warning) => warning.severity === "high").length,
    notes
  };
}

function frictionNotes({ config, report, fixedReport, suggestions }) {
  const notes = [];
  const unitCount = Array.isArray(config.unitCosts) ? config.unitCosts.length : 0;
  const planCount = Array.isArray(config.plans) ? config.plans.length : 0;
  const hasPercentiles = config.plans.some((plan) => plan.usagePercentiles || plan.percentileUsage || plan.usageScenarios);
  const suggestionTypes = new Set(suggestions.map((item) => item.type));
  const billingReadiness = config.assumptions && config.assumptions.billingReadiness;

  if (unitCount > 1) {
    notes.push("Post-wizard editing needs a clear prompt to add second and third cost units.");
  }
  if (planCount > 1) {
    notes.push("Users need to compare plans after fixing only one plan because risk often moves by tier.");
  }
  if (!hasPercentiles) {
    notes.push("Without usage percentiles, tail risk is invisible.");
  } else if (suggestionTypes.has("tail-risk")) {
    notes.push("Tail-risk findings require a pricing decision beyond the automatic patch.");
  }
  if (suggestionTypes.has("add-limit") || suggestionTypes.has("add-overage")) {
    notes.push("Limit and overage suggestions are concrete, but users still need billing-event names.");
  }
  if (suggestionTypes.has("bound-outcome")) {
    notes.push("Outcome pricing needs an explicit workload cap before it is launch-ready.");
  }
  if (!billingReadiness || ["manual", "draft", "basic-subscription"].includes(billingReadiness)) {
    notes.push("Billing readiness needs a next action, not just a warning.");
  }
  if (fixedReport.verdict !== "ship") {
    notes.push("The fixed copy still needs human review when target margin or warnings remain.");
  }
  if (report.verdict !== fixedReport.verdict) {
    notes.push(`Patch application changed verdict from ${report.verdict} to ${fixedReport.verdict}.`);
  }
  return notes;
}

function summarizeFindings(models) {
  const notes = new Map();
  for (const model of models) {
    for (const note of model.notes || []) {
      notes.set(note, (notes.get(note) || 0) + 1);
    }
  }
  return [...notes.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([note, count]) => ({ note, count }));
}

function formatTrial(result) {
  const lines = [];
  lines.push(`${result.name}: ${result.modelCount} models`);
  lines.push("");
  lines.push("Models");
  for (const model of result.models) {
    if (model.errors.length > 0) {
      lines.push(`- ${model.name}: invalid (${model.errors.join("; ")})`);
      continue;
    }
    lines.push(`- ${model.name}: ${model.verdict} -> ${model.fixedVerdict}, margin ${formatPercent(model.grossMargin)} -> ${formatPercent(model.fixedGrossMargin)}, warnings ${model.warnings} -> ${model.fixedWarnings}`);
  }
  lines.push("");
  lines.push("Friction");
  for (const finding of result.findings) {
    lines.push(`- ${finding.note} (${finding.count}/5)`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function valueFor(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  return args[index + 1];
}

main(process.argv.slice(2));
