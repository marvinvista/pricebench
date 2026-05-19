# Pricebench Alpha

Pricebench is a GitHub alpha.

- Install with `gh repo clone marvinvista/pricebench`.
- Expect the CLI and JSON schema to change while the pricing model workflow is tested.
- Keep real customer pricing data out of issues unless it is sanitized.

## Outside Tester Checklist

Use a fresh clone and run:

```bash
gh repo clone marvinvista/pricebench
cd pricebench
node scripts/outside-alpha-check.js
```

Manual path:

```bash
node bin/pricebench.js doctor
node bin/pricebench.js quickstart
node bin/pricebench.js init pricing.json --wizard
node bin/pricebench.js suggest pricing.json
node scripts/run-alpha-trial.js
```

Report:

- The first command that felt unclear.
- The hardest pricing input to estimate.
- Whether `suggest` produced a change you would actually review.
- Whether `doctor` gave enough setup confidence.
