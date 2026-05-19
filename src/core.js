const CURRENT_SCHEMA_VERSION = "0.2";
const SUPPORTED_SCHEMA_VERSIONS = new Set([CURRENT_SCHEMA_VERSION]);
const REQUIRED_TOP_LEVEL = ["plans"];

const PRINCIPLES = [
  {
    id: "ai-cogs",
    title: "AI has real marginal cost",
    detail: "Benchmark every plan against usage-driven COGS before treating pricing as a copy or packaging exercise.",
    sources: ["AI pricing COGS operating rule"]
  },
  {
    id: "hybrid-default",
    title: "Hybrid pricing is the default candidate",
    detail: "Start with subscription plus included usage, credits, add-ons, or overages unless the category clearly demands a larger business-model shift.",
    sources: ["AI pricing packaging rule"]
  },
  {
    id: "outcome-fit",
    title: "Outcome pricing needs clean measurement",
    detail: "Only recommend outcome pricing when the outcome is well-defined, measurable, and bounded enough that the AI cannot run wild.",
    sources: ["Outcome pricing guardrail"]
  },
  {
    id: "freemium-as-marketing",
    title: "Free AI usage is a marketing investment",
    detail: "Free usage can be rational when it creates activation, category education, word of mouth, and a natural paid limit.",
    sources: ["Freemium economics rule"]
  },
  {
    id: "activation-before-monetization",
    title: "Monetization follows activation",
    detail: "Pricing fixes should not hide a weak value moment. First prove that the right users reach value.",
    sources: ["Activation sequencing rule"]
  },
  {
    id: "pricing-infra",
    title: "Billing must be ready to iterate",
    detail: "Pricing experiments need usage events, aggregation, grandfathering rules, invoices, and edge-case ownership.",
    sources: ["Pricing infrastructure rule"]
  }
];

const MODEL_TYPES = new Set(["subscription", "hybrid", "credits", "outcome", "freemium", "usage"]);

function analyzeConfig(config) {
  const problems = lintConfig(config);
  if (problems.errors.length > 0) {
    const error = new Error(`Invalid pricebench config: ${problems.errors.join("; ")}`);
    error.problems = problems;
    throw error;
  }

  const unitCosts = new Map((config.unitCosts || []).map((entry) => [entry.unit, asNumber(entry.cost)]));
  const assumptions = config.assumptions || {};
  const targetGrossMargin = clampMargin(asNumber(assumptions.targetGrossMargin, 0.7));
  const freeMarketingBudgetPerAccount = asNumber(assumptions.freeMarketingBudgetPerAccount, 0);
  const plans = config.plans.map((plan) => analyzePlan(plan, unitCosts, {
    targetGrossMargin,
    freeMarketingBudgetPerAccount,
    assumptions
  }));

  const totals = plans.reduce((acc, plan) => {
    acc.accounts += plan.accounts;
    acc.revenue += plan.revenueTotal;
    acc.cost += plan.costTotal;
    acc.freeCost += plan.isFree ? plan.costTotal : 0;
    return acc;
  }, { accounts: 0, revenue: 0, cost: 0, freeCost: 0 });
  totals.grossProfit = totals.revenue - totals.cost;
  totals.grossMargin = totals.revenue > 0 ? totals.grossProfit / totals.revenue : 0;

  const warnings = [
    ...problems.warnings.map((message) => warning("config", "medium", message)),
    ...plans.flatMap((plan) => plan.warnings)
  ];

  const suggestions = buildSuggestions({ config, plans, targetGrossMargin, warnings });
  const recommendations = buildRecommendations({ config, plans, totals, targetGrossMargin, warnings, suggestions });
  const verdict = chooseVerdict(totals, targetGrossMargin, warnings);

  return {
    name: config.name || "Untitled pricing model",
    currency: config.currency || "USD",
    period: config.period || "month",
    targetGrossMargin,
    totals,
    plans,
    warnings,
    recommendations,
    suggestions,
    principles: PRINCIPLES,
    verdict
  };
}

function analyzePlan(plan, unitCosts, context) {
  const accounts = Math.max(0, asNumber(plan.accounts ?? plan.users ?? plan.customers, 1));
  const price = asNumber(plan.price, 0);
  const included = plan.included || plan.includedUnits || {};
  const averageUsage = plan.averageUsage || plan.avgUsage || {};
  const overage = plan.overage || {};
  const model = plan.model || inferModel(plan, price);
  const fixedCost = asNumber(plan.fixedCost, 0);
  const economics = calculatePlanEconomics({ price, fixedCost, included, overage, usage: averageUsage, unitCosts });
  const usageCost = economics.usageCost;
  const overageRevenue = economics.overageRevenue;
  const costPerAccount = economics.costPerAccount;
  const revenuePerAccount = economics.revenuePerAccount;
  const revenueTotal = revenuePerAccount * accounts;
  const costTotal = costPerAccount * accounts;
  const grossProfit = economics.grossProfit;
  const grossMargin = economics.grossMargin;
  const isFree = revenuePerAccount === 0 || model === "freemium";
  const usageScenarios = buildUsageScenarios(plan, { price, fixedCost, included, overage, unitCosts, targetGrossMargin: context.targetGrossMargin });

  const warnings = planWarnings(plan, {
    model,
    price,
    included,
    averageUsage,
    overage,
    unitCosts,
    revenuePerAccount,
    costPerAccount,
    grossMargin,
    isFree,
    usageScenarios,
    context
  });

  return {
    name: plan.name || "Unnamed plan",
    model,
    accounts,
    price,
    revenuePerAccount,
    costPerAccount,
    grossProfitPerAccount: grossProfit,
    grossMargin,
    fixedCost,
    usageCost,
    overageRevenue,
    revenueTotal,
    costTotal,
    isFree,
    averageUsage,
    included,
    overage,
    unitBreakdown: economics.unitBreakdown,
    overageBreakdown: economics.overageBreakdown,
    usageScenarios,
    warnings
  };
}

function planWarnings(plan, facts) {
  const warnings = [];
  const {
    model,
    averageUsage,
    included,
    overage,
    unitCosts,
    revenuePerAccount,
    costPerAccount,
    grossMargin,
    isFree,
    usageScenarios,
    context
  } = facts;

  for (const unit of Object.keys(averageUsage)) {
    if (!unitCosts.has(unit)) {
      warnings.push(warning(plan.name, "high", `Usage unit "${unit}" has no unit cost. Margin is understated or unknown.`));
    }
  }

  for (const [unit, usage] of Object.entries(averageUsage)) {
    const used = asNumber(usage);
    const includedUnits = asNumber(included[unit], 0);
    const hasLimit = Object.prototype.hasOwnProperty.call(included, unit);
    const hasOverage = asNumber(overage[unit], 0) > 0;
    if (hasLimit && used > includedUnits && !hasOverage && !isFree) {
      warnings.push(warning(plan.name, "high", `Average ${unit} usage exceeds the included limit without overage revenue.`));
    }
    if (!hasLimit && !hasOverage && unitCosts.has(unit) && !isFree) {
      warnings.push(warning(plan.name, "medium", `Paid plan has ${unit} COGS but no included limit or overage rule.`));
    }
  }

  if (!isFree && grossMargin < context.targetGrossMargin) {
    warnings.push(warning(plan.name, "high", `Gross margin ${formatPercent(grossMargin)} is below target ${formatPercent(context.targetGrossMargin)}.`));
  }

  if (isFree && context.freeMarketingBudgetPerAccount > 0 && costPerAccount > context.freeMarketingBudgetPerAccount) {
    warnings.push(warning(plan.name, "medium", `Free usage costs ${formatMoney(costPerAccount)} per account, above the marketing budget of ${formatMoney(context.freeMarketingBudgetPerAccount)}.`));
  }

  if (isFree && !context.assumptions.activationMoment) {
    warnings.push(warning(plan.name, "medium", "Free usage has no activation moment. Do not spend AI COGS before users feel value."));
  }

  if (model === "outcome") {
    if (!plan.outcome) {
      warnings.push(warning(plan.name, "high", "Outcome-priced plan does not name the paid outcome."));
    }
    if (!plan.measurableOutcome) {
      warnings.push(warning(plan.name, "high", "Outcome pricing needs a measurable success event."));
    }
    if (!plan.finiteWorkload) {
      warnings.push(warning(plan.name, "high", "Outcome pricing is risky when work is not bounded."));
    }
  }

  if (model === "credits" && !plan.creditPolicy) {
    warnings.push(warning(plan.name, "medium", "Credit plan should define topups, expiry, rollover, and what consumes credits."));
  }

  if (revenuePerAccount > 0 && costPerAccount / revenuePerAccount > 0.4) {
    warnings.push(warning(plan.name, "medium", `COGS consumes ${formatPercent(costPerAccount / revenuePerAccount)} of revenue per account.`));
  }

  for (const scenario of usageScenarios) {
    if (!isFree && scenario.grossMargin < context.targetGrossMargin) {
      const severity = scenario.label === "p99" || scenario.label === "p90" ? "high" : "medium";
      warnings.push(warning(plan.name, severity, `${scenario.label.toUpperCase()} usage margin ${formatPercent(scenario.grossMargin)} is below target ${formatPercent(context.targetGrossMargin)}.`));
    }
  }

  return warnings;
}

function lintConfig(config) {
  const errors = [];
  const warnings = [];
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return { errors: ["config must be a JSON object"], warnings };
  }
  for (const key of REQUIRED_TOP_LEVEL) {
    if (!Object.prototype.hasOwnProperty.call(config, key)) {
      errors.push(`missing required field "${key}"`);
    }
  }
  if (config.plans && !Array.isArray(config.plans)) {
    errors.push("plans must be an array");
  }
  if (config.unitCosts && !Array.isArray(config.unitCosts)) {
    errors.push("unitCosts must be an array");
  }
  if (config.currency !== undefined && typeof config.currency !== "string") {
    errors.push("currency must be a string");
  }
  if (config.period !== undefined && typeof config.period !== "string") {
    errors.push("period must be a string");
  }
  if (config.schemaVersion !== undefined) {
    if (typeof config.schemaVersion !== "string") {
      errors.push("schemaVersion must be a string");
    } else if (!SUPPORTED_SCHEMA_VERSIONS.has(config.schemaVersion)) {
      errors.push(`schemaVersion "${config.schemaVersion}" is not supported by this Pricebench release`);
    }
  }
  if (config.assumptions !== undefined && (!config.assumptions || typeof config.assumptions !== "object" || Array.isArray(config.assumptions))) {
    errors.push("assumptions must be an object");
  }
  if (config.assumptions && config.assumptions.targetGrossMargin !== undefined && !isFiniteNumber(config.assumptions.targetGrossMargin)) {
    errors.push("assumptions.targetGrossMargin must be a number");
  }
  if (config.assumptions && config.assumptions.freeMarketingBudgetPerAccount !== undefined && !isFiniteNumber(config.assumptions.freeMarketingBudgetPerAccount)) {
    errors.push("assumptions.freeMarketingBudgetPerAccount must be a number");
  }
  if (Array.isArray(config.unitCosts)) {
    for (const [index, entry] of config.unitCosts.entries()) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        errors.push(`unitCosts[${index}] must be an object`);
        continue;
      }
      if (!entry.unit || typeof entry.unit !== "string") errors.push(`unitCosts[${index}] missing unit`);
      if (entry.cost === undefined) errors.push(`unitCosts[${index}] missing cost`);
      if (entry.cost !== undefined && (!isFiniteNumber(entry.cost) || Number(entry.cost) < 0)) {
        errors.push(`unitCosts[${index}].cost must be a non-negative number`);
      }
    }
  }
  if (Array.isArray(config.plans)) {
    config.plans.forEach((plan, index) => {
      if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
        errors.push(`plans[${index}] must be an object`);
        return;
      }
      if (!plan.name) warnings.push(`plans[${index}] has no name`);
      if (plan.name !== undefined && typeof plan.name !== "string") errors.push(`plans[${index}].name must be a string`);
      if (plan.model !== undefined && !MODEL_TYPES.has(plan.model)) errors.push(`${plan.name || `plans[${index}]`} has unknown model "${plan.model}"`);
      if (plan.price !== undefined && (!isFiniteNumber(plan.price) || Number(plan.price) < 0)) errors.push(`${plan.name || `plans[${index}]`}.price must be a non-negative number`);
      if (plan.accounts !== undefined && (!isFiniteNumber(plan.accounts) || Number(plan.accounts) < 0)) errors.push(`${plan.name || `plans[${index}]`}.accounts must be a non-negative number`);
      if (plan.users !== undefined && (!isFiniteNumber(plan.users) || Number(plan.users) < 0)) errors.push(`${plan.name || `plans[${index}]`}.users must be a non-negative number`);
      if (plan.customers !== undefined && (!isFiniteNumber(plan.customers) || Number(plan.customers) < 0)) errors.push(`${plan.name || `plans[${index}]`}.customers must be a non-negative number`);
      if (plan.fixedCost !== undefined && (!isFiniteNumber(plan.fixedCost) || Number(plan.fixedCost) < 0)) errors.push(`${plan.name || `plans[${index}]`}.fixedCost must be a non-negative number`);
      if (plan.price === undefined && !plan.overage) warnings.push(`${plan.name || `plans[${index}]`} has no price or overage rule`);
      if (!plan.averageUsage && !plan.avgUsage) warnings.push(`${plan.name || `plans[${index}]`} has no averageUsage`);
      pushNumberRecordErrors(errors, plan.included || plan.includedUnits, `${plan.name || `plans[${index}]`}.included`);
      pushNumberRecordErrors(errors, plan.averageUsage || plan.avgUsage, `${plan.name || `plans[${index}]`}.averageUsage`);
      pushNumberRecordErrors(errors, plan.overage, `${plan.name || `plans[${index}]`}.overage`);
      pushUsageScenarioErrors(errors, plan.usagePercentiles || plan.percentileUsage || plan.usageScenarios, `${plan.name || `plans[${index}]`}.usagePercentiles`);
      if (plan.creditPolicy !== undefined && (!plan.creditPolicy || typeof plan.creditPolicy !== "object" || Array.isArray(plan.creditPolicy))) {
        errors.push(`${plan.name || `plans[${index}]`}.creditPolicy must be an object`);
      }
      if (plan.measurableOutcome !== undefined && typeof plan.measurableOutcome !== "boolean") {
        errors.push(`${plan.name || `plans[${index}]`}.measurableOutcome must be a boolean`);
      }
      if (plan.finiteWorkload !== undefined && typeof plan.finiteWorkload !== "boolean") {
        errors.push(`${plan.name || `plans[${index}]`}.finiteWorkload must be a boolean`);
      }
    });
  }
  return { errors, warnings };
}

function compareReports(leftReport, rightReport, labels = {}) {
  const left = summarizeReport(leftReport, labels.left || "left");
  const right = summarizeReport(rightReport, labels.right || "right");
  const delta = {
    revenue: right.revenue - left.revenue,
    cost: right.cost - left.cost,
    grossProfit: right.grossProfit - left.grossProfit,
    grossMargin: right.grossMargin - left.grossMargin,
    warnings: right.warningCount - left.warningCount,
    highWarnings: right.highWarningCount - left.highWarningCount
  };
  const winner = chooseComparisonWinner(left, right);
  const notes = buildComparisonNotes(left, right, delta);
  return { left, right, delta, winner, notes };
}

function runSensitivity(config, options = {}) {
  const costMultipliers = options.costMultipliers || [0.6, 0.8, 1, 1.2, 1.4];
  const usageMultipliers = options.usageMultipliers || [0.75, 1, 1.25, 1.5];
  const baseline = summarizeReport(analyzeConfig(config), "baseline");
  const scenarios = [];

  for (const costMultiplier of costMultipliers) {
    for (const usageMultiplier of usageMultipliers) {
      const scenarioConfig = scaleConfig(config, costMultiplier, usageMultiplier);
      const report = analyzeConfig(scenarioConfig);
      scenarios.push({
        costMultiplier,
        usageMultiplier,
        ...summarizeReport(report, `cost x${costMultiplier} / usage x${usageMultiplier}`)
      });
    }
  }

  return {
    name: baseline.name,
    baseline,
    costMultipliers,
    usageMultipliers,
    scenarios
  };
}

function suggestConfig(config, options = {}) {
  const workingConfig = cloneConfig(config);
  if (!workingConfig.schemaVersion) workingConfig.schemaVersion = CURRENT_SCHEMA_VERSION;
  if (options.targetGrossMargin !== undefined) {
    workingConfig.assumptions = {
      ...(workingConfig.assumptions || {}),
      targetGrossMargin: clampMargin(asNumber(options.targetGrossMargin, 0.7))
    };
  }
  const report = analyzeConfig(workingConfig);
  const suggestions = report.suggestions;
  const result = {
    name: report.name,
    verdict: report.verdict,
    targetGrossMargin: report.targetGrossMargin,
    suggestions,
    summary: summarizeSuggestions(suggestions)
  };
  if (options.patch) {
    result.patch = buildSuggestionPatch(workingConfig, suggestions);
  }
  return result;
}

function applySuggestionPatch(config, patch) {
  if (!Array.isArray(patch)) {
    throw new Error("patch must be an array");
  }
  const cloned = cloneConfig(config);
  if (!cloned.schemaVersion) cloned.schemaVersion = CURRENT_SCHEMA_VERSION;
  for (const operation of patch) {
    applyPatchOperation(cloned, operation);
  }
  return cloned;
}

function explainConfig(config, options = {}) {
  const report = analyzeConfig(config);
  const planName = options.plan;
  const plans = planName
    ? report.plans.filter((plan) => plan.name.toLowerCase() === String(planName).toLowerCase())
    : report.plans;
  if (planName && plans.length === 0) {
    const error = new Error(`Unknown plan "${planName}". Available: ${report.plans.map((plan) => plan.name).join(", ")}`);
    error.code = "UNKNOWN_PLAN";
    throw error;
  }
  return {
    name: report.name,
    verdict: report.verdict,
    targetGrossMargin: report.targetGrossMargin,
    plans: plans.map((plan) => explainPlan(plan)),
    totals: {
      revenue: report.totals.revenue,
      cost: report.totals.cost,
      grossProfit: report.totals.grossProfit,
      grossMargin: report.totals.grossMargin
    }
  };
}

function scaleConfig(config, costMultiplier, usageMultiplier) {
  const cloned = cloneConfig(config);
  if (Array.isArray(cloned.unitCosts)) {
    cloned.unitCosts = cloned.unitCosts.map((entry) => ({
      ...entry,
      cost: roundMoney(asNumber(entry.cost) * costMultiplier)
    }));
  }
  if (Array.isArray(cloned.plans)) {
    cloned.plans = cloned.plans.map((plan) => ({
      ...plan,
      averageUsage: scaleNumberRecord(plan.averageUsage, usageMultiplier),
      avgUsage: plan.avgUsage ? scaleNumberRecord(plan.avgUsage, usageMultiplier) : plan.avgUsage
    }));
  }
  return cloned;
}

function calculatePlanEconomics({ price, fixedCost, included, overage, usage, unitCosts }) {
  const unitBreakdown = Object.entries(usage || {}).map(([unit, rawUsage]) => {
    const quantity = asNumber(rawUsage);
    const unitCost = unitCosts.has(unit) ? unitCosts.get(unit) : 0;
    const cost = quantity * unitCost;
    return { unit, quantity, unitCost, cost };
  });
  const usageCost = unitBreakdown.reduce((sum, entry) => sum + entry.cost, 0);
  const overageBreakdown = Object.entries(usage || {}).map(([unit, rawUsage]) => {
    const quantity = asNumber(rawUsage);
    const includedUnits = asNumber((included || {})[unit], 0);
    const overageUnits = Math.max(0, quantity - includedUnits);
    const overagePrice = asNumber((overage || {})[unit], 0);
    const revenue = overageUnits * overagePrice;
    return { unit, quantity, included: includedUnits, overageUnits, overagePrice, revenue };
  });
  const overageRevenue = overageBreakdown.reduce((sum, entry) => sum + entry.revenue, 0);
  const revenuePerAccount = asNumber(price) + overageRevenue;
  const costPerAccount = asNumber(fixedCost) + usageCost;
  const grossProfit = revenuePerAccount - costPerAccount;
  const grossMargin = revenuePerAccount > 0 ? grossProfit / revenuePerAccount : 0;
  return {
    price: asNumber(price),
    fixedCost: asNumber(fixedCost),
    usageCost,
    overageRevenue,
    revenuePerAccount,
    costPerAccount,
    grossProfit,
    grossMargin,
    unitBreakdown,
    overageBreakdown
  };
}

function buildUsageScenarios(plan, context) {
  const scenarioSource = plan.usagePercentiles || plan.percentileUsage || plan.usageScenarios;
  if (!scenarioSource || typeof scenarioSource !== "object" || Array.isArray(scenarioSource)) return [];
  return Object.entries(scenarioSource)
    .filter(([, usage]) => usage && typeof usage === "object" && !Array.isArray(usage))
    .map(([label, usage]) => {
      const economics = calculatePlanEconomics({
        price: context.price,
        fixedCost: context.fixedCost,
        included: context.included,
        overage: context.overage,
        usage,
        unitCosts: context.unitCosts
      });
      return {
        label: String(label).toLowerCase(),
        usage,
        revenuePerAccount: economics.revenuePerAccount,
        costPerAccount: economics.costPerAccount,
        grossProfitPerAccount: economics.grossProfit,
        grossMargin: economics.grossMargin,
        unitBreakdown: economics.unitBreakdown,
        overageBreakdown: economics.overageBreakdown,
        belowTarget: economics.grossMargin < context.targetGrossMargin
      };
    })
    .sort((left, right) => scenarioRank(left.label) - scenarioRank(right.label));
}

function explainPlan(plan) {
  return {
    name: plan.name,
    model: plan.model,
    accounts: plan.accounts,
    formulas: {
      revenuePerAccount: "base price + sum(max(0, usage - included) * overage price)",
      costPerAccount: "fixed cost + sum(usage * unit cost)",
      grossMargin: "(revenue per account - cost per account) / revenue per account"
    },
    inputs: {
      price: plan.price,
      fixedCost: plan.fixedCost,
      included: plan.included,
      overage: plan.overage,
      averageUsage: plan.averageUsage
    },
    unitCosts: plan.unitBreakdown.map((entry) => ({
      unit: entry.unit,
      usage: entry.quantity,
      unitCost: entry.unitCost,
      cost: entry.cost,
      formula: `${formatUnitCount(entry.quantity)} * ${formatMoney(entry.unitCost)} = ${formatMoney(entry.cost)}`
    })),
    overages: plan.overageBreakdown.map((entry) => ({
      unit: entry.unit,
      usage: entry.quantity,
      included: entry.included,
      overageUnits: entry.overageUnits,
      overagePrice: entry.overagePrice,
      revenue: entry.revenue,
      formula: `max(0, ${formatUnitCount(entry.quantity)} - ${formatUnitCount(entry.included)}) * ${formatMoney(entry.overagePrice)} = ${formatMoney(entry.revenue)}`
    })),
    arithmetic: {
      revenuePerAccount: `${formatMoney(plan.price)} base + ${formatMoney(plan.overageRevenue)} overage = ${formatMoney(plan.revenuePerAccount)}`,
      costPerAccount: `${formatMoney(plan.fixedCost)} fixed + ${formatMoney(plan.usageCost)} usage = ${formatMoney(plan.costPerAccount)}`,
      grossProfitPerAccount: `${formatMoney(plan.revenuePerAccount)} - ${formatMoney(plan.costPerAccount)} = ${formatMoney(plan.grossProfitPerAccount)}`,
      grossMargin: `${formatMoney(plan.grossProfitPerAccount)} / ${formatMoney(plan.revenuePerAccount)} = ${formatPercent(plan.grossMargin)}`
    },
    result: {
      revenuePerAccount: plan.revenuePerAccount,
      costPerAccount: plan.costPerAccount,
      grossProfitPerAccount: plan.grossProfitPerAccount,
      grossMargin: plan.grossMargin,
      revenueTotal: plan.revenueTotal,
      costTotal: plan.costTotal
    },
    usageScenarios: plan.usageScenarios
  };
}

function buildRecommendations({ config, plans, totals, targetGrossMargin, warnings, suggestions }) {
  const recommendations = [];
  const hasHighMarginWarning = warnings.some((item) => item.severity === "high" && item.message.includes("Gross margin"));
  const hasMissingCost = warnings.some((item) => item.message.includes("has no unit cost"));
  const hasFreePlan = plans.some((plan) => plan.isFree);
  const hasPaidPlan = plans.some((plan) => !plan.isFree);
  const hasOutcome = plans.some((plan) => plan.model === "outcome");
  const billingReadiness = config.assumptions && config.assumptions.billingReadiness;

  if (hasMissingCost) {
    recommendations.push("Instrument usage events and unit costs before making pricing decisions.");
  }
  if (hasHighMarginWarning || totals.grossMargin < targetGrossMargin) {
    recommendations.push("Add usage limits, overages, credits, or higher-tier packaging before scaling acquisition.");
  }
  if (hasFreePlan && hasPaidPlan) {
    recommendations.push("Treat free AI usage as marketing spend and make the upgrade moment happen after the first value moment.");
  }
  if (hasOutcome) {
    recommendations.push("Keep outcome pricing only where the success event is auditable, finite, and easy for buyers to understand.");
  }
  if (!billingReadiness || billingReadiness === "basic-subscription") {
    recommendations.push("Upgrade billing readiness: capture usage events, aggregate them by account, support topups or overages, and document grandfathering rules.");
  }
  for (const suggestion of suggestions.slice(0, 2)) {
    recommendations.push(suggestion.summary);
  }
  if (recommendations.length === 0) {
    recommendations.push("Model is coherent enough for a customer-facing pricing experiment. Review positioning, checkout, and sales handoff next.");
  }
  return recommendations;
}

function buildSuggestions({ config, plans, targetGrossMargin, warnings }) {
  const suggestions = [];
  const unitCosts = new Map((config.unitCosts || []).map((entry) => [entry.unit, asNumber(entry.cost)]));
  const freeBudget = asNumber((config.assumptions || {}).freeMarketingBudgetPerAccount, 0);

  for (const warningItem of warnings) {
    const missingUnit = warningItem.message.match(/Usage unit "([^"]+)" has no unit cost/);
    if (missingUnit) {
      suggestions.push(suggestion({
        scope: "unitCosts",
        type: "add-unit-cost",
        severity: "high",
        summary: `Add a unit cost for ${missingUnit[1]} before trusting margin.`,
        rationale: "Without a unit cost, Pricebench cannot calculate usage COGS for that meter."
      }));
    }
  }

  for (const [planIndex, plan] of plans.entries()) {
    const overageRevenue = Math.max(0, plan.revenuePerAccount - plan.price);
    const requiredRevenue = plan.costPerAccount > 0 ? plan.costPerAccount / Math.max(0.01, 1 - targetGrossMargin) : 0;

    if (!plan.isFree && requiredRevenue > plan.revenuePerAccount + 0.01) {
      const requiredBasePrice = roundPrice(Math.max(plan.price, requiredRevenue - overageRevenue));
      const lift = requiredBasePrice - plan.price;
      suggestions.push(suggestion({
        scope: plan.name,
        planIndex,
        type: "raise-price",
        severity: "high",
        summary: `Raise ${plan.name} base price to at least ${formatMoney(requiredBasePrice)} or add ${formatMoney(Math.max(0, requiredRevenue - plan.revenuePerAccount))} equivalent usage revenue to hit ${formatPercent(targetGrossMargin)} margin.`,
        rationale: `${plan.name} needs ${formatMoney(requiredRevenue)} revenue per account against ${formatMoney(plan.costPerAccount)} COGS.`,
        current: { price: plan.price, revenuePerAccount: plan.revenuePerAccount, grossMargin: plan.grossMargin },
        proposed: { price: requiredBasePrice, priceLift: lift }
      }));
    }

    if (!plan.isFree && plan.revenuePerAccount > 0 && plan.costPerAccount / plan.revenuePerAccount > 0.4 && requiredRevenue <= plan.revenuePerAccount + 0.01) {
      const bufferMargin = Math.min(0.85, Math.max(targetGrossMargin + 0.05, 0.6));
      const bufferRevenue = plan.costPerAccount / Math.max(0.01, 1 - bufferMargin);
      if (bufferRevenue > plan.revenuePerAccount + 0.01) {
        const bufferedBasePrice = roundPrice(Math.max(plan.price, bufferRevenue - overageRevenue));
        suggestions.push(suggestion({
        scope: plan.name,
        planIndex,
        type: "add-margin-buffer",
          severity: "medium",
          summary: `Raise ${plan.name} base price to about ${formatMoney(bufferedBasePrice)} or reduce COGS by ${formatMoney(plan.costPerAccount - plan.revenuePerAccount * (1 - bufferMargin))} per account for a ${formatPercent(bufferMargin)} margin buffer.`,
          rationale: `${plan.name} clears the target but COGS still consumes ${formatPercent(plan.costPerAccount / plan.revenuePerAccount)} of revenue.`,
          current: { price: plan.price, grossMargin: plan.grossMargin },
          proposed: { price: bufferedBasePrice, marginBuffer: bufferMargin }
        }));
      }
    }

    for (const [unit, usage] of Object.entries(plan.averageUsage)) {
      const used = asNumber(usage);
      const includedUnits = asNumber(plan.included[unit], 0);
      const hasLimit = Object.prototype.hasOwnProperty.call(plan.included, unit);
      const hasOverage = asNumber(plan.overage[unit], 0) > 0;
      const unitCost = unitCosts.get(unit);

      if (!plan.isFree && hasLimit && used > includedUnits && !hasOverage && unitCost !== undefined) {
        const overagePrice = roundRate(unitCost / Math.max(0.01, 1 - targetGrossMargin));
        suggestions.push(suggestion({
          scope: plan.name,
          planIndex,
          unit,
          type: "add-overage",
          severity: "high",
          summary: `Charge at least ${formatMoney(overagePrice)} per ${unit} above ${formatUnitCount(includedUnits)} included units on ${plan.name}.`,
          rationale: `Average usage is ${formatUnitCount(used)} ${unit}, so included usage is already exceeded without revenue.`,
          current: { included: includedUnits, averageUsage: used },
          proposed: { overage: { [unit]: overagePrice } }
        }));
      }

      if (!plan.isFree && !hasLimit && !hasOverage && unitCost !== undefined) {
        const limit = Math.max(1, Math.ceil(used * 0.85));
        const overagePrice = roundRate(unitCost / Math.max(0.01, 1 - targetGrossMargin));
        suggestions.push(suggestion({
          scope: plan.name,
          planIndex,
          unit,
          type: "add-limit",
          severity: "medium",
          summary: `Add a ${formatUnitCount(limit)} ${unit} included limit and a ${formatMoney(overagePrice)} overage to ${plan.name}.`,
          rationale: `${plan.name} has ${unit} COGS but no usage boundary.`,
          current: { averageUsage: used },
          proposed: { included: { [unit]: limit }, overage: { [unit]: overagePrice } }
        }));
      }
    }

    if (plan.isFree && freeBudget > 0 && plan.costPerAccount > freeBudget) {
      const reduction = Math.max(0, plan.costPerAccount - freeBudget);
      suggestions.push(suggestion({
        scope: plan.name,
        planIndex,
        type: "free-budget",
        severity: "medium",
        summary: `Reduce ${plan.name} free-plan usage by about ${formatMoney(reduction)} COGS per account or raise the free marketing budget.`,
        rationale: `${plan.name} costs ${formatMoney(plan.costPerAccount)} per account against a ${formatMoney(freeBudget)} budget.`,
        current: { costPerAccount: plan.costPerAccount, budget: freeBudget }
      }));
    }

    if (plan.model === "outcome") {
      const workloadWarning = plan.warnings.some((item) => item.message.includes("not bounded"));
      if (workloadWarning) {
        suggestions.push(suggestion({
          scope: plan.name,
          planIndex,
          type: "bound-outcome",
          severity: "high",
          summary: `Add a finite workload cap to ${plan.name} before using outcome pricing.`,
          rationale: "Outcome-priced work needs a bounded success event so usage cannot run without limit."
        }));
      }
    }

    for (const scenario of plan.usageScenarios) {
      if (!plan.isFree && scenario.belowTarget) {
        suggestions.push(suggestion({
          scope: plan.name,
          planIndex,
          type: "tail-risk",
          severity: scenario.label === "p99" || scenario.label === "p90" ? "high" : "medium",
          summary: `Reprice ${plan.name} for ${scenario.label.toUpperCase()} usage: margin falls to ${formatPercent(scenario.grossMargin)} at that usage level.`,
          rationale: `${scenario.label.toUpperCase()} usage costs ${formatMoney(scenario.costPerAccount)} per account against ${formatMoney(scenario.revenuePerAccount)} revenue.`,
          current: { scenario: scenario.label, grossMargin: scenario.grossMargin }
        }));
      }
    }
  }

  return suggestions.sort((left, right) => severityRank(right.severity) - severityRank(left.severity));
}

function summarizeSuggestions(suggestions) {
  if (suggestions.length === 0) {
    return "No pricing changes required by the current checks.";
  }
  const high = suggestions.filter((item) => item.severity === "high").length;
  const medium = suggestions.filter((item) => item.severity === "medium").length;
  return `${suggestions.length} suggested change${suggestions.length === 1 ? "" : "s"} (${high} high, ${medium} medium).`;
}

function buildSuggestionPatch(config, suggestions) {
  const patch = [];
  for (const item of suggestions) {
    const planIndex = item.planIndex ?? findPlanIndex(config, item.scope);
    if (planIndex === -1) continue;
    const plan = config.plans[planIndex] || {};
    if (item.type === "raise-price" || item.type === "add-margin-buffer") {
      const price = item.proposed && item.proposed.price;
      if (price !== undefined) {
        patch.push(upsertPatch(plan.price, `/plans/${planIndex}/price`, price));
      }
    }
    if (item.type === "add-overage" && item.unit && item.proposed && item.proposed.overage) {
      if (!plan.overage) patch.push({ op: "add", path: `/plans/${planIndex}/overage`, value: {} });
      patch.push(upsertPatch(plan.overage && plan.overage[item.unit], `/plans/${planIndex}/overage/${escapeJsonPointer(item.unit)}`, item.proposed.overage[item.unit]));
    }
    if (item.type === "add-limit" && item.unit && item.proposed) {
      if (item.proposed.included) {
        if (!plan.included) patch.push({ op: "add", path: `/plans/${planIndex}/included`, value: {} });
        patch.push(upsertPatch(plan.included && plan.included[item.unit], `/plans/${planIndex}/included/${escapeJsonPointer(item.unit)}`, item.proposed.included[item.unit]));
      }
      if (item.proposed.overage) {
        if (!plan.overage) patch.push({ op: "add", path: `/plans/${planIndex}/overage`, value: {} });
        patch.push(upsertPatch(plan.overage && plan.overage[item.unit], `/plans/${planIndex}/overage/${escapeJsonPointer(item.unit)}`, item.proposed.overage[item.unit]));
      }
    }
    if (item.type === "bound-outcome" && plan.finiteWorkload !== true) {
      patch.push(upsertPatch(plan.finiteWorkload, `/plans/${planIndex}/finiteWorkload`, true));
    }
  }
  return dedupePatch(patch);
}

function chooseVerdict(totals, targetGrossMargin, warnings) {
  if (warnings.some((item) => item.severity === "high")) return "revise";
  if (totals.revenue > 0 && totals.grossMargin < targetGrossMargin) return "revise";
  if (warnings.length > 0) return "watch";
  return "ship";
}

function inferModel(plan, price) {
  if (price === 0) return "freemium";
  if (plan.outcome) return "outcome";
  if (plan.creditPolicy) return "credits";
  if (plan.overage && Object.keys(plan.overage).length > 0) return "hybrid";
  return "subscription";
}

function warning(scope, severity, message) {
  return { scope: scope || "config", severity, message };
}

function suggestion({ scope, planIndex, unit, type, severity, summary, rationale, current, proposed }) {
  return {
    scope,
    ...(planIndex !== undefined ? { planIndex } : {}),
    ...(unit ? { unit } : {}),
    type,
    severity,
    summary,
    rationale,
    ...(current ? { current } : {}),
    ...(proposed ? { proposed } : {})
  };
}

function summarizeReport(report, label) {
  const highWarningCount = report.warnings.filter((item) => item.severity === "high").length;
  return {
    label,
    name: report.name,
    verdict: report.verdict,
    revenue: report.totals.revenue,
    cost: report.totals.cost,
    grossProfit: report.totals.grossProfit,
    grossMargin: report.totals.grossMargin,
    targetGrossMargin: report.targetGrossMargin,
    warningCount: report.warnings.length,
    highWarningCount,
    suggestionCount: report.suggestions.length,
    planCount: report.plans.length,
    recommendations: report.recommendations
  };
}

function chooseComparisonWinner(left, right) {
  const verdictScore = { revise: 0, watch: 1, ship: 2 };
  const leftScore = verdictScore[left.verdict] ?? 0;
  const rightScore = verdictScore[right.verdict] ?? 0;
  if (leftScore !== rightScore) return leftScore > rightScore ? left.label : right.label;
  if (left.highWarningCount !== right.highWarningCount) return left.highWarningCount < right.highWarningCount ? left.label : right.label;
  if (Math.abs(left.grossMargin - right.grossMargin) > 0.01) return left.grossMargin > right.grossMargin ? left.label : right.label;
  if (Math.abs(left.grossProfit - right.grossProfit) > 1) return left.grossProfit > right.grossProfit ? left.label : right.label;
  return "tie";
}

function buildComparisonNotes(left, right, delta) {
  const notes = [];
  if (left.verdict !== right.verdict) notes.push(`Verdict changes from ${left.verdict} to ${right.verdict}.`);
  if (Math.abs(delta.grossMargin) >= 0.01) notes.push(`Gross margin moves by ${formatPercent(delta.grossMargin)}.`);
  if (delta.highWarnings !== 0) notes.push(`High-severity warnings change by ${delta.highWarnings}.`);
  if (delta.revenue !== 0) notes.push(`Revenue changes by ${formatMoney(delta.revenue)}.`);
  if (notes.length === 0) notes.push("Models are effectively tied on verdict, margin, warnings, and profit.");
  return notes;
}

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function clampMargin(value) {
  if (value > 1) return value / 100;
  if (value < 0) return 0;
  return value;
}

function formatMoney(value, currency = "$") {
  const sign = value < 0 ? "-" : "";
  return `${sign}${currency}${Math.abs(value).toFixed(2)}`;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatUnitCount(value) {
  return Number.isInteger(value) ? String(value) : String(roundUsage(value));
}

function pushNumberRecordErrors(errors, record, label) {
  if (record === undefined) return;
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    errors.push(`${label} must be an object`);
    return;
  }
  for (const [key, value] of Object.entries(record)) {
    if (!isFiniteNumber(value) || Number(value) < 0) {
      errors.push(`${label}.${key} must be a non-negative number`);
    }
  }
}

function pushUsageScenarioErrors(errors, scenarios, label) {
  if (scenarios === undefined) return;
  if (!scenarios || typeof scenarios !== "object" || Array.isArray(scenarios)) {
    errors.push(`${label} must be an object`);
    return;
  }
  for (const [scenarioName, record] of Object.entries(scenarios)) {
    pushNumberRecordErrors(errors, record, `${label}.${scenarioName}`);
  }
}

function scaleNumberRecord(record, multiplier) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return record;
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, roundUsage(asNumber(value) * multiplier)]));
}

function cloneConfig(config) {
  return JSON.parse(JSON.stringify(config));
}

function roundUsage(value) {
  return Math.round(value * 1000) / 1000;
}

function roundMoney(value) {
  return Math.round(value * 10000) / 10000;
}

function roundPrice(value) {
  return Math.ceil(value);
}

function roundRate(value) {
  return Math.ceil(value * 100) / 100;
}

function severityRank(severity) {
  return { low: 0, medium: 1, high: 2 }[severity] ?? 0;
}

function scenarioRank(label) {
  const normalized = String(label).toLowerCase();
  const rank = { p50: 50, p75: 75, p90: 90, p95: 95, p99: 99 };
  return rank[normalized] ?? (Number(normalized.replace(/^p/, "")) || 1000);
}

function findPlanIndex(config, planName) {
  if (!Array.isArray(config.plans)) return -1;
  return config.plans.findIndex((plan) => plan && String(plan.name).toLowerCase() === String(planName).toLowerCase());
}

function upsertPatch(currentValue, path, value) {
  return { op: currentValue === undefined ? "add" : "replace", path, value };
}

function dedupePatch(patch) {
  const seen = new Set();
  const result = [];
  for (const operation of patch) {
    const key = `${operation.op}:${operation.path}:${JSON.stringify(operation.value)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(operation);
  }
  return result;
}

function escapeJsonPointer(value) {
  return String(value).replace(/~/g, "~0").replace(/\//g, "~1");
}

function applyPatchOperation(target, operation) {
  if (!operation || typeof operation !== "object" || Array.isArray(operation)) {
    throw new Error("patch operation must be an object");
  }
  if (!["add", "replace"].includes(operation.op)) {
    throw new Error(`unsupported patch operation "${operation.op}"`);
  }
  if (typeof operation.path !== "string" || !operation.path.startsWith("/")) {
    throw new Error("patch operation path must be a JSON pointer");
  }

  const parts = operation.path.slice(1).split("/").map(unescapeJsonPointer);
  const finalKey = parts.pop();
  const parent = parts.reduce((current, part, index) => {
    const key = pointerKey(current, part);
    if (Number.isNaN(key)) {
      throw new Error(`patch path "${operation.path}" has an invalid array index`);
    }
    if (current[key] === undefined || current[key] === null) {
      current[key] = nextContainerFor(parts[index + 1]);
    }
    if (typeof current[key] !== "object") {
      throw new Error(`patch path "${operation.path}" cannot traverse a scalar value`);
    }
    return current[key];
  }, target);
  const key = pointerKey(parent, finalKey);

  if (Array.isArray(parent)) {
    if (operation.op === "add" && finalKey === "-") {
      parent.push(cloneJsonValue(operation.value));
      return;
    }
    if (!Number.isInteger(key) || key < 0 || key > parent.length) {
      throw new Error(`patch path "${operation.path}" has an invalid array index`);
    }
    if (operation.op === "replace" && key >= parent.length) {
      throw new Error(`patch path "${operation.path}" cannot replace a missing array item`);
    }
    if (operation.op === "add") {
      parent.splice(key, 0, cloneJsonValue(operation.value));
      return;
    }
  } else if (operation.op === "replace" && !Object.prototype.hasOwnProperty.call(parent, key)) {
    throw new Error(`patch path "${operation.path}" cannot replace a missing field`);
  }

  parent[key] = cloneJsonValue(operation.value);
}

function pointerKey(container, part) {
  if (!Array.isArray(container)) return part;
  if (part === "-") return part;
  const index = Number(part);
  return Number.isInteger(index) ? index : Number.NaN;
}

function nextContainerFor(part) {
  return /^\d+$/.test(part) ? [] : {};
}

function unescapeJsonPointer(value) {
  return String(value).replace(/~1/g, "/").replace(/~0/g, "~");
}

function cloneJsonValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

module.exports = {
  CURRENT_SCHEMA_VERSION,
  PRINCIPLES,
  analyzeConfig,
  applySuggestionPatch,
  compareReports,
  explainConfig,
  lintConfig,
  runSensitivity,
  suggestConfig,
  formatMoney,
  formatPercent
};
