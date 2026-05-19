# Usage Percentiles

Averages hide the users who break AI margins. Pricebench supports `usagePercentiles` so a plan can pass average usage while still failing at P90 or P99.

## Shape

```json
{
  "usagePercentiles": {
    "p50": { "research_run": 18, "source_fetch": 400 },
    "p90": { "research_run": 48, "source_fetch": 1000 },
    "p99": { "research_run": 95, "source_fetch": 2200 }
  }
}
```

Every percentile record uses the same unit names as `averageUsage` and `unitCosts`.

## How To Use It

1. Pull account-level usage for the last billing period.
2. Group by the unit that drives COGS.
3. Calculate P50, P90, and P99 per account.
4. Add those records to each plan.
5. Run `pricebench analyze` and `pricebench explain`.

```bash
pricebench analyze pricing.json
pricebench explain pricing.json --plan Pro
```

If P99 fails while average usage passes, decide whether to add a limit, overage, credit policy, or higher tier before scaling the plan.

## Do Not Auto-Patch Tail Risk

The alpha models all produced tail-risk findings. Pricebench reports these as decisions, not automatic edits, because P90/P99 fixes may require a new tier, a fair-use policy, sales review, or a hard cap.

After applying a patch, rerun:

```bash
pricebench analyze pricing.fixed.json
pricebench compare pricing.json pricing.fixed.json
```
