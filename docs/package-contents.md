# Package Contents

Pricebench ships from GitHub as original code, alpha models, examples, docs, helper scripts, and schema.

## Included

- CLI executable in `bin/`.
- Core analyzer, fixtures, and command formatting in `src/`.
- Repeatable alpha models in `alpha/models/`.
- Public examples in `examples/`.
- Launch assets in `assets/`.
- Release, GitHub-install smoke, alpha trial, public-surface, outside alpha, and alpha smoke helper scripts in `scripts/`.
- JSON Schema in `schema/`.
- Documentation, changelog, contributing guide, license, and agent instructions.
- Roadmap and security policy.

## Excluded

- Local drafts and non-product background material.
- Temporary caches, generated archives, coverage output, and editor files.

## Verification

Run the release checks before a public GitHub release:

```bash
node --test
node bin/pricebench.js doctor --json
node scripts/verify-public-surface.js
node scripts/run-alpha-trial.js
node scripts/smoke-github-install.js
node scripts/outside-alpha-check.js
```

The release files should explain Pricebench as a standalone product.
