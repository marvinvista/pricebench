# Launch Notes

## One-Liner

Pricebench catches AI pricing margin leaks before customers do.

## Demo Command

```bash
gh repo clone marvinvista/pricebench
cd pricebench
node bin/pricebench.js suggest demo:agentic-research
```

## Short Post

AI products often look profitable until usage shows up.

Pricebench is a small CLI for stress-testing AI pricing models against unit costs, margin targets, free-plan spend, overage rules, credit policies, and outcome-pricing risk.

It gives you a verdict, then suggests concrete knobs: raise price, add an overage, reduce included usage, or cap an unbounded workload.

```bash
pricebench init pricing.json --wizard
pricebench analyze pricing.json
pricebench suggest pricing.json
```

## Screenshot

Use [../assets/terminal-demo.svg](../assets/terminal-demo.svg) for the first launch image.
