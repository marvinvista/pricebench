# Estimating Unit Costs

Pricebench is only as useful as the unit costs you give it. Start with one meter that maps to the expensive part of the product, then add more meters only when they change a pricing decision.

## Pick The Meter

Use the smallest unit a customer action consumes repeatedly:

- `message` for chat products.
- `research_run` for agent workflows.
- `image` or `render` for creative generation.
- `meeting_hour` or `transcript_minute` for meeting tools.
- `row_enriched` or `web_lookup` for data products.

Avoid vague meters such as `usage` or `activity`. They hide the actual cost driver.

## Add More Than One Unit

The alpha models all needed more than one unit. After `init --wizard`, check whether a customer action also triggers retrieval, processing, storage, transcription, rendering, or tool calls. Add those as separate `unitCosts` entries when they change margin.

Example:

```json
{
  "unitCosts": [
    { "unit": "document_review", "cost": 3.25 },
    { "unit": "clause_extract", "cost": 0.08 }
  ]
}
```

## Calculate The Cost

For each unit, estimate:

- Model calls.
- Retrieval, search, scraping, or tool calls.
- Storage and processing tied to the action.
- Human review cost if it happens on every unit.
- Vendor fees that scale with usage.

Use a conservative blended number. If your cost varies by customer size, model P50, P90, and P99 usage rather than averaging it away.

## Validate With Logs

Before using a model for a pricing launch, compare the estimate against a sample of real accounts:

```bash
pricebench explain pricing.json --plan Pro
pricebench sensitivity pricing.json --cost 0.8,1,1.2 --usage 1,1.5
```

If the conclusion changes when costs move by 20%, keep the plan out of a public pricing page until you have better measurement.
