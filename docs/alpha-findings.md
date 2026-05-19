# Alpha Findings

This alpha pass runs five representative AI pricing models through the same workflow a tester would use:

```bash
node scripts/run-alpha-trial.js
```

## Models

| Model | Verdict before | Verdict after patch | Margin before | Margin after patch |
| --- | --- | --- | --- | --- |
| Agentic CRM cleanup | revise | ship | -49.5% | 76.6% |
| Creative ad studio | revise | revise | 21.7% | 52.8% |
| Legal review agent | revise | ship | 15.0% | 77.2% |
| Sales call analyzer | revise | revise | 23.1% | 67.3% |
| Support triage API | revise | revise | 15.5% | 74.0% |

## Friction Observed

- All five models needed more than one cost unit, so the wizard cannot be the end of setup.
- All five models exposed tail-risk decisions that should not be auto-patched.
- All five models needed a plan comparison after applying fixes because risk often moved by tier.
- Three models needed billing-readiness next actions, not just warnings.
- Three models needed concrete billing-event names for suggested limits and overages.
- Three fixed copies still needed human review because target margin or warnings remained.
- One outcome-pricing model needed an explicit workload cap before launch.

## Fresh Clone Rehearsal

Run on 2026-05-19 from a clean GitHub clone:

```bash
node bin/pricebench.js quickstart
node scripts/outside-alpha-check.js
```

The first-run commands completed without hand-holding. A realistic support-triage copilot model was then edited from the starter file and tested with:

```bash
node bin/pricebench.js analyze pricebench.json
node bin/pricebench.js suggest pricebench.json
node bin/pricebench.js explain pricebench.json --plan Team
node bin/pricebench.js suggest pricebench.json --apply --output pricebench.fixed.json
node bin/pricebench.js compare pricebench.json pricebench.fixed.json
```

Observed result:

- Original model: `revise`, -19.4% gross margin, 11 warnings.
- Patched copy: `revise`, 67.7% gross margin, 5 warnings.
- The patched copy improved margin materially but still needed human review because percentile risk remained.

Additional friction:

- Quickstart was clear enough to start, but the first edit still requires users to estimate p50, p90, and p99 usage without much guidance.
- The generated next step is useful, but users still need an example of what a "real" edited model looks like after replacing demo values.
- `suggest --apply` can make a model much better while the verdict remains `revise`; the compare step is the clearest way to understand progress.
- Billing readiness needs to be translated into named events before recommendations can become implementation work.

## Product Changes Made

- Added `scripts/run-alpha-trial.js` to run and summarize the five-model pass.
- Added `alpha/models/` so alpha coverage is repeatable.
- Added GitHub-clone install docs and smoke validation.
- Updated setup docs to tell users what to edit after `init --wizard`.
- Updated billing and unit-cost docs with field-level next actions.
