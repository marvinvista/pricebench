# Walkthrough

This walkthrough uses the bundled `agentic-research` model because it shows the failure modes Pricebench is meant to catch: underpriced AI work, no overage on exceeded usage, and an outcome-priced plan without a workload cap.

## 1. Analyze The Model

```bash
pricebench analyze examples/agentic-research.json
```

Expected result:

```text
Verdict: revise
```

The model is below target margin and has high-risk warnings.

## 2. Explain The Math

```bash
pricebench explain examples/agentic-research.json --plan Pro
```

Look at:

- Revenue per account.
- COGS per account.
- Gross margin.
- Unit-cost formulas.
- P90 and P99 usage rows.

This tells you whether the problem is base price, included usage, overages, or tail usage.

## 3. Generate A Patch

```bash
pricebench suggest examples/agentic-research.json --patch
```

The patch shows the edits Pricebench can make safely:

- Raise an underpriced base price.
- Add overage prices when average usage already exceeds included usage.
- Add a workload cap to risky outcome pricing.

Tail-risk warnings are intentionally left as review items because a P99 fix may require a tier, fair-use policy, or sales process change.

## 4. Apply To A Copy

```bash
pricebench suggest examples/agentic-research.json --apply --output /tmp/agentic-research.fixed.json
```

Pricebench writes a new JSON model and leaves the original untouched.

## 5. Compare

```bash
pricebench compare examples/agentic-research.json /tmp/agentic-research.fixed.json
```

Use the delta to decide whether the fixed copy is ready for customer-facing packaging or whether it needs a larger business-model change.
