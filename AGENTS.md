# Agent Instructions

Pricebench is a CLI-first product. Keep the surface agent-friendly:

- Prefer dependency-free Node unless a dependency removes real complexity.
- Keep the CLI usable by humans and agents: clear help, deterministic JSON, actionable text output.
- Add tests for every new pricing rule.
- Do not add non-product background or local-only notes to public docs.
- Keep examples small enough that agents can edit and rerun them quickly.
- Before release, run:

```bash
node --test
node bin/pricebench.js status --json
node bin/pricebench.js doctor --json
node scripts/verify-public-surface.js
node scripts/outside-alpha-check.js
```

## Design Rules

- Start with the model and CLI before building UI.
- Treat pricing recommendations as risk flags, not magic answers.
- Label missing data instead of guessing.
- If a command mutates files, require an explicit output path or `--force`.
- Public copy should say what the tool does and how to use it.
