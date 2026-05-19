# Release

Pricebench is distributed from GitHub for the alpha.

## Preflight

```bash
node --test
node bin/pricebench.js status --json
node bin/pricebench.js doctor --json
node bin/pricebench.js quickstart /tmp/pricebench-quickstart.json --json
node bin/pricebench.js demo ai-support
node bin/pricebench.js compare demo:ai-support demo:creative-agent --json
node bin/pricebench.js suggest demo:agentic-research --patch
node bin/pricebench.js suggest demo:agentic-research --apply --output /tmp/agentic-research.fixed.json --json
node bin/pricebench.js explain demo:agentic-research --plan Pro --json
node bin/pricebench.js sensitivity demo:agentic-research --cost 0.8,1,1.2 --usage 1,1.5 --json
node scripts/verify-public-surface.js
node scripts/alpha-smoke.js
node scripts/run-alpha-trial.js
node scripts/smoke-github-install.js
node scripts/outside-alpha-check.js
```

Review [docs/output-captures.md](output-captures.md) after changes that affect report formatting.

## GitHub Candidate

The release-candidate workflow validates the repo and uploads a source archive that can be installed with `gh`:

```bash
gh workflow run release-candidate.yml
gh run list --workflow "Release Candidate" --limit 1
```

For a local source archive:

```bash
git archive --format=tar.gz --prefix=pricebench/ --output=/tmp/pricebench-source.tar.gz HEAD
```

## Public GitHub Release

Do not make the repo public until the alpha findings are reviewed and the install path passes:

```bash
node scripts/run-alpha-trial.js
node scripts/smoke-github-install.js
node scripts/verify-public-surface.js
node scripts/outside-alpha-check.js
```

Suggested release flow:

```bash
git tag v0.2.0
git push origin v0.2.0
gh release create v0.2.0 --title "Pricebench v0.2.0" --notes-file docs/launch.md
```
