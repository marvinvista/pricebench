# Changelog

## 0.2.0 - 2026-05-19

- Added `compare` for model-to-model pricing deltas.
- Added `sensitivity` for cost and usage stress tests.
- Added `suggest` for concrete price, limit, overage, and workload-cap recommendations.
- Added `init --wizard` for guided first-model creation.
- Added `explain` for auditable plan math.
- Added `usagePercentiles` for P50, P90, and P99 tail-risk modeling.
- Added `suggest --patch` for dry-run JSON Patch output.
- Added `suggest --apply --output` for writing reviewed fixed copies.
- Added `doctor` for release-readiness checks.
- Added schema versioning with `schemaVersion: "0.2"`.
- Added golden command snapshots and alpha smoke checks.
- Added billing, unit-cost, usage-percentile, model workflow, alpha-trial, and walkthrough docs.
- Added a manual release-candidate workflow that uploads a GitHub source artifact.
- Added a five-model alpha harness and GitHub-clone install smoke test.
- Switched public install and release docs to GitHub-first distribution.
- Added JSON Schema, CI, release docs, package contents docs, and release validation.
- Added three primary demos plus five messy dogfood fixtures.
- Added polished public examples, roadmap, security policy, issue templates, and pull request template.
- Removed non-product background from the public docs and CLI output.

## 0.1.0 - 2026-05-19

- Initial dependency-free CLI with `analyze`, `bench`, `demo`, `init`, `lint`, `explain`, and `status`.
