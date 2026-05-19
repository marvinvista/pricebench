# Pricing Principles

Pricebench packages a small set of operating rules for AI pricing work. The rules are intentionally practical and testable: each one should lead to either a model field, a warning, a recommendation, or a demo fixture.

## Rules

- AI usage carries real marginal cost, so every metered unit needs a unit cost before margin can be trusted.
- Hybrid pricing is usually the first candidate: subscription plus included usage, credits, topups, add-ons, or overages.
- Outcome pricing needs a named outcome, measurable success event, and bounded workload.
- Free AI usage is a marketing investment, not a magic acquisition channel.
- Monetization work should follow activation; do not optimize price before the user reaches the value moment.
- Billing must be ready to iterate: usage events, account-level aggregation, topups or overages, invoice clarity, and grandfathering.

## Translation Into Pricebench Checks

- Flag missing unit costs for metered usage.
- Flag paid plans where usage exceeds included limits without overage revenue.
- Flag gross margin below target.
- Flag expensive free usage unless it is intentionally budgeted as marketing spend.
- Flag outcome pricing without a named outcome, measurable success event, or finite workload.
- Recommend billing-readiness work before serious pricing iteration.
- Compare model variants by verdict, margin, warning count, and profit.
- Stress-test margin against usage and cost spikes.
- Suggest concrete plan changes before asking the user to rerun the model.
- Explain the arithmetic so users can audit the exact margin calculation.
- Treat P90 and P99 usage as first-class risk inputs, not afterthoughts.
