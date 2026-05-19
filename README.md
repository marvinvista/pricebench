# Pricebench

[![CI](https://github.com/marvinvista/pricebench/actions/workflows/ci.yml/badge.svg)](https://github.com/marvinvista/pricebench/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Pricebench is a CLI for stress-testing AI pricing models against usage COGS, margin targets, free-plan spend, overage rules, credit policies, and outcome-pricing risk. It is deliberately simple: JSON in, report out, tests around the math, and commands that agents can run repeatedly while editing the model.

Built by [Marvin Vista](https://github.com/marvinvista). Need hands-on help? [fob.dev](https://fob.dev) helps B2B AI teams pressure-test pricing, usage COGS, free-plan exposure, and packaging before launch.

## Install

Install from GitHub with `gh`:

```bash
gh repo clone marvinvista/pricebench
cd pricebench
node bin/pricebench.js quickstart
```

Add the binary to your shell path:

```bash
mkdir -p ~/.local/bin
ln -sf "$PWD/bin/pricebench.js" ~/.local/bin/pricebench
pricebench demo ai-support
```

Validate the checkout:

```bash
node --test
node scripts/alpha-smoke.js
node scripts/run-alpha-trial.js
node scripts/outside-alpha-check.js
```

## Five-Minute Benchmark

1. Create a starter model and see the next commands:

```bash
node bin/pricebench.js quickstart pricing.json
```

2. Edit the generated `pricing.json` so the unit cost, included usage, average usage, and price match your current plan.

   Add any second or third cost unit, usage percentiles, and billing readiness details that matter for your product.

3. Run the benchmark:

```bash
node bin/pricebench.js analyze pricing.json
```

4. Get concrete pricing knobs:

```bash
node bin/pricebench.js suggest pricing.json
```

5. Write a patched copy you can review:

```bash
node bin/pricebench.js suggest pricing.json --apply --output pricing.fixed.json
```

6. Stress-test cost and usage changes:

```bash
node bin/pricebench.js sensitivity pricing.json --cost 0.8,1,1.2 --usage 1,1.5
```

## Commands

```bash
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
```

## Demos

The bundled examples cover three real pricing shapes:

- `ai-support`: hybrid and outcome pricing that clears margin checks, verdict `ship`.
- `creative-agent`: credit pricing with basic billing readiness and a tight COGS profile, verdict `watch`.
- `agentic-research`: underpriced agentic work with unbounded outcome risk, verdict `revise`.
- More messy fixtures: `chat-copilot`, `code-agent`, `data-enrichment`, `image-api`, and `meeting-notes`.

Copyable examples live in `examples/`:

- `examples/ai-support.json`
- `examples/chat-copilot.json`
- `examples/code-agent.json`
- `examples/creative-agent.json`
- `examples/data-enrichment.json`
- `examples/image-api.json`
- `examples/meeting-notes.json`
- `examples/agentic-research.json`

```bash
node bin/pricebench.js compare demo:ai-support demo:creative-agent
node bin/pricebench.js suggest demo:agentic-research
node bin/pricebench.js explain demo:agentic-research --plan Pro
node bin/pricebench.js sensitivity demo:agentic-research --cost 0.8,1,1.2 --usage 1,1.5
```

Alpha trial models live in `alpha/models/` and can be run together:

```bash
node scripts/run-alpha-trial.js
```

## Model

```json
{
  "schemaVersion": "0.2",
  "name": "AI support desk",
  "currency": "USD",
  "period": "month",
  "assumptions": {
    "targetGrossMargin": 0.7,
    "freeMarketingBudgetPerAccount": 1.5,
    "activationMoment": "First correctly resolved support question",
    "billingReadiness": "metered-events-ready"
  },
  "unitCosts": [
    { "unit": "resolution", "cost": 0.18 }
  ],
  "plans": [
    {
      "name": "Team",
      "model": "hybrid",
      "price": 149,
      "accounts": 900,
      "included": { "resolution": 250 },
      "overage": { "resolution": 0.75 },
      "averageUsage": { "resolution": 310 },
      "usagePercentiles": {
        "p50": { "resolution": 240 },
        "p90": { "resolution": 390 },
        "p99": { "resolution": 520 }
      }
    }
  ]
}
```

The JSON Schema lives at [schema/pricebench.schema.json](schema/pricebench.schema.json).

## What It Checks

- Whether AI usage has real COGS that can break SaaS-style margin assumptions.
- Whether paid plans have limits, credits, add-ons, or overages before usage scales.
- Whether outcome pricing has a measurable success event and bounded workload.
- Whether free AI usage is budgeted as marketing spend after an activation moment.
- Whether billing can support usage events, aggregation, topups, invoices, and grandfathering.
- Whether sensitivity to cost or usage spikes turns a good-looking plan into a bad one.
- Whether P50, P90, and P99 usage exposes tail-risk that averages hide.
- Which price, limit, overage, or workload-cap changes would move a risky plan closer to target margin.

## Example

```bash
node bin/pricebench.js demo ai-support
```

Output:

```text
Pricebench: AI support desk
Verdict: ship
Overall gross margin: 72.7% (target 70.0%)
```

Suggestion output:

```bash
node bin/pricebench.js suggest demo:agentic-research
```

```text
Pricebench suggest: Agentic research workspace
Verdict: revise
Summary: 12 suggested changes (9 high, 3 medium).
- [high] Pro: Raise Pro base price to at least $270.00 or add $221.00 equivalent usage revenue to hit 70.0% margin.
```

Math explanation:

```bash
node bin/pricebench.js explain demo:agentic-research --plan Pro
```

Patch dry run:

```bash
node bin/pricebench.js suggest demo:agentic-research --patch
```

Apply a patched copy:

```bash
node bin/pricebench.js suggest examples/agentic-research.json --apply --output /tmp/agentic-research.fixed.json
```

## What It Does Not Do

- It does not replace buyer research, willingness-to-pay work, or positioning.
- It does not connect to billing systems.
- It does not estimate unit costs for you.
- It does not publish, transmit, or store your pricing model.

## Release Boundary

This repo contains the product surface only: code, examples, docs, tests, and schema. Keep background research and local-only notes out of the release.

See [ALPHA.md](ALPHA.md), [docs/github-install.md](docs/github-install.md), [docs/pricing-principles.md](docs/pricing-principles.md), [docs/estimate-unit-costs.md](docs/estimate-unit-costs.md), [docs/billing-mapping.md](docs/billing-mapping.md), [docs/usage-percentiles.md](docs/usage-percentiles.md), [docs/model-first-product.md](docs/model-first-product.md), [docs/walkthrough.md](docs/walkthrough.md), [docs/alpha-trial.md](docs/alpha-trial.md), [docs/alpha-findings.md](docs/alpha-findings.md), [docs/package-contents.md](docs/package-contents.md), and [docs/release.md](docs/release.md) before a public GitHub release.
