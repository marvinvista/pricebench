# Architecture

Pricebench has three layers:

- `bin/pricebench.js`: thin executable wrapper.
- `src/cli.js`: argument parsing, wizard prompts, IO, and report formatting.
- `src/core.js`: pure pricing analysis, math explanation, tail-usage modeling, linting, warnings, recommendations, concrete suggestions, comparison, sensitivity analysis, and pricing principles.

Fixtures live in `src/fixtures.js` so tests and demos use the same data.

## Why CLI First

Pricing model iteration is a tight loop:

1. Run `pricebench quickstart` or edit a JSON model.
2. Run `pricebench analyze`.
3. Run `pricebench suggest`.
4. Adjust limits, credits, overages, prices, or assumptions.
5. Run again.

That loop is easy for agents to operate and easy for humans to inspect.

## Data Model

Each model has:

- `assumptions`: target gross margin, free usage budget, activation moment, billing readiness.
- `unitCosts`: cost per metered AI unit.
- `plans`: price, accounts, included usage, average usage, overage rules, and model type.
- `usagePercentiles`: optional `p50`, `p90`, and `p99` usage records for tail-risk modeling.

Supported model types are:

- `subscription`
- `hybrid`
- `credits`
- `freemium`
- `outcome`
- `usage`

The engine also infers a model type when one is omitted.

## Release Checks

```bash
node --test
node bin/pricebench.js quickstart /tmp/pricebench-quickstart.json --json
node bin/pricebench.js demo ai-support --json
node bin/pricebench.js compare demo:ai-support demo:creative-agent --json
node bin/pricebench.js suggest demo:agentic-research --json
node bin/pricebench.js suggest demo:agentic-research --patch
node bin/pricebench.js explain demo:agentic-research --plan Pro --json
node bin/pricebench.js sensitivity demo:agentic-research --cost 0.8,1,1.2 --usage 1,1.5 --json
node bin/pricebench.js lint examples/ai-support.json
node scripts/verify-public-surface.js
node scripts/run-alpha-trial.js
node scripts/smoke-github-install.js
node scripts/outside-alpha-check.js
```
