# Contributing

Pricebench is intentionally small. Keep changes testable from the CLI.

## Local Checks

```bash
npm test
node bin/pricebench.js demo ai-support
node bin/pricebench.js compare demo:ai-support demo:creative-agent --json
node bin/pricebench.js sensitivity demo:agentic-research --cost 0.8,1,1.2 --usage 1,1.5 --json
npm pack --dry-run
```

## Rules

- Keep the runtime dependency-free unless a dependency removes real complexity.
- Add tests for every new pricing rule, command, fixture, or schema requirement.
- Keep JSON output deterministic and easy for agents to inspect.
- Do not add non-product background or local-only notes to packaged files.
- Prefer concrete warnings over broad pricing advice.
