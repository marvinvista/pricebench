# Model-First Product Workflow

Pricebench works best when pricing is modeled before the public page, checkout, sales script, or launch announcement.

## Workflow

1. Start from a fixture close to your product:

```bash
pricebench init pricing.json --example agentic-research
```

2. Replace every unit cost and usage number with your current best estimate.

   The wizard creates a narrow first draft. Real models usually need a second or third `unitCosts` entry, `usagePercentiles`, and a specific `billingReadiness` value before the report is useful.

3. Explain the plan math:

```bash
pricebench explain pricing.json --plan Pro
```

4. Generate suggested changes:

```bash
pricebench suggest pricing.json --patch
```

5. Write a reviewed copy:

```bash
pricebench suggest pricing.json --apply --output pricing.fixed.json
```

6. Compare the original against the fixed copy:

```bash
pricebench compare pricing.json pricing.fixed.json
```

## Launch Rule

Do not ship a public plan until:

- Unit costs are named.
- Billing events are named for every suggested limit or overage.
- The target gross margin is explicit.
- Free usage has a budget and value moment.
- Paid usage has a limit, overage, credit policy, or clear cap.
- P90 and P99 usage do not silently destroy margin.
