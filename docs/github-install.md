# GitHub Install

Pricebench is distributed from GitHub for the alpha.

See [../ALPHA.md](../ALPHA.md) for the tester checklist.

## Clone

```bash
gh repo clone marvinvista/pricebench
cd pricebench
node bin/pricebench.js quickstart
node bin/pricebench.js doctor
```

## Add `pricebench` To PATH

```bash
mkdir -p ~/.local/bin
ln -sf "$PWD/bin/pricebench.js" ~/.local/bin/pricebench
pricebench demo ai-support
```

Make sure `~/.local/bin` is on your shell `PATH`.

## Update

```bash
cd pricebench
git pull --ff-only
node bin/pricebench.js doctor
```

## Validate A Checkout

```bash
node --test
node scripts/alpha-smoke.js
node scripts/run-alpha-trial.js
node scripts/smoke-github-install.js
node scripts/verify-public-surface.js
node scripts/outside-alpha-check.js
```
