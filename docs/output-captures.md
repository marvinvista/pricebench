# Output Captures

These captures are smoke-test examples for review and release notes.

## `pricebench quickstart pricing.json`

```text
Pricebench quickstart
Wrote pricing.json from demo:ai-support
Verdict: ship
Overall gross margin: 72.7% (target 70.0%)
Suggestions: No pricing changes required by the current checks.
```

## `pricebench demo ai-support`

```text
Pricebench: AI support desk
Verdict: ship
Overall revenue: $352800.00 / month
Overall COGS: $96276.00 / month
Overall gross margin: 72.7% (target 70.0%)
```

## `pricebench demo creative-agent`

```text
Pricebench: AI video creative agent
Verdict: watch
Overall revenue: $179200.00 / month
Overall COGS: $79188.00 / month
Overall gross margin: 55.8% (target 55.0%)
Warnings
- [medium] Creator: COGS consumes 40.5% of revenue per account.
```

## `pricebench demo agentic-research`

```text
Pricebench: Agentic research workspace
Verdict: revise
Overall revenue: $87300.00 / month
Overall COGS: $98820.00 / month
Overall gross margin: -13.2% (target 70.0%)
```

## `pricebench compare demo:ai-support demo:creative-agent`

```text
Pricebench compare
Left: demo:ai-support (ship, margin 72.7%, warnings 0)
Right: demo:creative-agent (watch, margin 55.8%, warnings 1)
Winner: demo:ai-support
```

## `pricebench suggest demo:agentic-research`

```text
Pricebench suggest: Agentic research workspace
Source: demo:agentic-research
Verdict: revise
Target margin: 70.0%
Summary: 12 suggested changes (9 high, 3 medium).

Suggested changes
- [high] Pro: Raise Pro base price to at least $270.00 or add $221.00 equivalent usage revenue to hit 70.0% margin.
- [high] Pro: Charge at least $7.00 per research_run above 10 included units on Pro.
- [high] Pro: Reprice Pro for P90 usage: margin falls to -166.9% at that usage level.
- [high] Team: Add a finite workload cap to Team before using outcome pricing.
```

## `pricebench explain demo:agentic-research --plan Pro`

```text
Pricebench explain: Agentic research workspace
Source: demo:agentic-research
Verdict: revise
Overall margin: -13.2% (target 70.0%)

Pro (subscription)
- Revenue/account: $49.00 base + $0.00 overage = $49.00
- COGS/account: $0.00 fixed + $81.00 usage = $81.00
- Gross margin: -$32.00 / $49.00 = -65.3%
- Usage percentiles
  - P90: revenue/account $49.00, COGS/account $130.80, margin -166.9%
```

## `pricebench suggest demo:agentic-research --patch`

```text
JSON Patch (dry run)
[
  { "op": "replace", "path": "/plans/0/price", "value": 270 },
  { "op": "add", "path": "/plans/0/overage/research_run", "value": 7 }
]
```

## `pricebench suggest demo:agentic-research --apply --output /tmp/agentic-research.fixed.json`

```text
Applied 9 patch operations.
Wrote /tmp/agentic-research.fixed.json
```

## `pricebench doctor`

```text
Pricebench doctor 0.2.0
Schema version: 0.2
OK node-version: Node 22.x; Pricebench requires Node 20 or newer.
OK public-surface: Packaged text has no blocked release markers.
Ready for release-candidate checks.
```

## `node scripts/run-alpha-trial.js`

```text
Pricebench alpha trial: 5 models

Models
- Agentic CRM cleanup: revise -> ship, margin -49.5% -> 76.6%, warnings 13 -> 0
- Creative ad studio: revise -> revise, margin 21.7% -> 52.8%, warnings 4 -> 0
- Legal review agent: revise -> ship, margin 15.0% -> 77.2%, warnings 13 -> 0
- Sales call analyzer: revise -> revise, margin 23.1% -> 67.3%, warnings 8 -> 1
- Support triage API: revise -> revise, margin 15.5% -> 74.0%, warnings 10 -> 2
```

## `node scripts/smoke-github-install.js`

```text
GitHub install smoke OK: /tmp/.../pricebench
```

## `node scripts/verify-public-surface.js`

```text
Public surface OK: 54 files scanned.
```

## `node scripts/outside-alpha-check.js`

```text
[ok] pricebench doctor
[ok] pricebench quickstart <quickstart-model>
[ok] pricebench init <wizard-model> --wizard
[ok] pricebench suggest <wizard-model>
[ok] node scripts/run-alpha-trial.js
Outside alpha check OK: /tmp/.../pricebench-outside-...
```

## `pricebench sensitivity demo:agentic-research --cost 0.8,1,1.2 --usage 1,1.5`

```text
Pricebench sensitivity: Agentic research workspace
Source: demo:agentic-research
Baseline: revise, margin -13.2%, warnings 8

Scenarios
- cost x0.8 / usage x1: revise, margin 9.4%, warnings 8
- cost x1 / usage x1: revise, margin -13.2%, warnings 8
- cost x1.2 / usage x1.5: revise, margin -63.3%, warnings 8
```
