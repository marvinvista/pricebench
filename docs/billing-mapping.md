# Billing Mapping

Pricebench models the pricing shape. Your billing system still needs clean events and rules before that shape can run with customers.

## Required Events

For each priced unit, define one event:

- `account_id`
- `unit`
- `quantity`
- `timestamp`
- `plan`
- `source_system`

Aggregate events by account and billing period. Pricebench assumes those aggregates are available when it checks included usage, overages, and tail risk.

## Name Events Before Applying Patches

When `pricebench suggest` adds a limit or overage, map the affected unit to an event name before changing checkout or invoices.

| Suggested unit | Event name example |
| --- | --- |
| `research_run` | `research_run_completed` |
| `document_review` | `document_review_finished` |
| `ticket_triage` | `ticket_triage_routed` |
| `render` | `creative_render_completed` |

## Plan Fields To Map

| Pricebench field | Billing meaning |
| --- | --- |
| `price` | Recurring base price for the billing period |
| `included` | Included quantity before charging extra |
| `overage` | Unit price after included usage is exceeded |
| `averageUsage` | Expected quantity per account |
| `usagePercentiles` | P50/P90/P99 usage checks for risk |
| `creditPolicy` | Topup, expiry, rollover, and consumption rules |
| `finiteWorkload` | Workload cap for outcome-priced work |

## Readiness Levels

- `draft`: Model can be discussed, but billing rules are not ready.
- `basic-subscription`: Recurring plans work, but usage-based changes need build time.
- `metered-events-ready`: Usage is captured and can be invoiced or limited.

If readiness is `draft`, `manual`, or `basic-subscription`, assign one next action: event capture, account-level aggregation, invoice line item mapping, or cap enforcement.

Run:

```bash
pricebench doctor
pricebench suggest pricing.json --patch
```

Use the patch as a pricing-model diff, not as a billing-system migration.
