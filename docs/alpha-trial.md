# Alpha Trial

Use this script when testing Pricebench with a small group before a public release.

The alpha install path is GitHub.

## Setup

Ask each tester to bring one current or planned AI pricing model. They do not need perfect data. They do need a best estimate for each expensive usage unit.

Install from GitHub and run the product smoke tests first:

```bash
gh repo clone marvinvista/pricebench
cd pricebench
node scripts/alpha-smoke.js
node scripts/smoke-github-install.js
node scripts/outside-alpha-check.js
```

Then give testers this path:

```bash
node bin/pricebench.js quickstart pricing.json
node bin/pricebench.js analyze pricing.json
node bin/pricebench.js explain pricing.json --plan Pro
node bin/pricebench.js suggest pricing.json --patch
node bin/pricebench.js suggest pricing.json --apply --output pricing.fixed.json
node bin/pricebench.js compare pricing.json pricing.fixed.json
```

Run the five-model alpha harness after each docs or command change:

```bash
node scripts/run-alpha-trial.js
```

## Questions To Ask

- Which input field was hardest to estimate?
- Did the warning match a real concern?
- Did the suggested change feel concrete enough to act on?
- Did the explain output make the margin math auditable?
- What billing rule would block applying the recommendation?
- Which command would you run again next week?

## Exit Criteria

Move toward public release when at least five real models have been tested and the same field or command is not causing repeated confusion.

Current five-model findings are tracked in [docs/alpha-findings.md](alpha-findings.md).
