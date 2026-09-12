# AI Arman dependency security audit — 2026-08-16

## Scope

This audit was performed on `feature/ai-arman-foundation-v1` after the private beta0 Cloud Run baseline had been deployed. The audit phase made no Cloud Run deployment, traffic, IAM, model, widget, or feature-flag changes.

The goal was to classify the npm findings reported by the beta0 container build, identify runtime versus dev/build exposure, avoid blind `npm audit fix`, and only apply dependency updates that were first reproduced in isolated CI copies.

## Baseline findings

Before remediation:

- Runtime audit (`npm audit --omit=dev --json`): **6 total**
  - 3 high
  - 2 moderate
  - 1 low
  - 0 critical
- Full audit (`npm audit --json`): **10 total**
  - 6 high
  - 2 moderate
  - 2 low
  - 0 critical

Important runtime findings included:

- `@nestjs/platform-express` / transitive `multer`: high-severity denial-of-service advisories.
- TypeORM dependency graph / `brace-expansion`: high-severity denial-of-service advisories.
- `typeorm`: moderate advisories, including an `orderBy` SQL-injection advisory affecting the installed 0.3.28 line and a migration-template code-injection advisory below 0.3.31.
- `qs`: moderate denial-of-service advisory.
- `body-parser`: low denial-of-service advisory.

Full-audit-only findings additionally included transitive build/dev packages such as `@babel/core`, `fast-uri`, `form-data`, and `js-yaml`.

## Remediation method

No blind `npm audit fix` was applied.

The dependency changes were tested in isolated `/tmp` copies in GitHub Actions before touching the branch lockfile. The verified dependency set stayed within existing package.json semver ranges; no major-version upgrade was required.

Runtime remediation updated the lockfile dependency graph, including:

- `@nestjs/common` 11.1.19 -> 11.2.1
- `@nestjs/core` 11.1.19 -> 11.2.1
- `@nestjs/platform-express` 11.1.19 -> 11.2.1
- `@nestjs/typeorm` 11.0.1 -> 11.0.3
- `typeorm` 0.3.28 -> 0.3.31
- `pg` 8.20.0 -> 8.23.0
- `multer` 2.1.1 -> 2.2.0
- vulnerable `brace-expansion` copies to fixed patch versions
- `qs` 6.15.1 -> 6.15.3
- `body-parser` 2.2.2 -> 2.3.0

Runtime remediation commit:

- `5bb9372cded23fdc8a2fc4617ccefe85905d46b2` — `Remediate AI Arman runtime dependency vulnerabilities`

After the isolated runtime remediation test:

- Runtime audit: **0 vulnerabilities**
- Full audit: 4 remaining dev/build-only findings

The remaining dev/build findings were then tested separately in isolation. The safe lockfile-only remediation included patch/minor updates for the affected transitive Babel packages, `fast-uri`, `form-data`, and `js-yaml`.

Dev/build remediation commit:

- `e6dd6f403181a9374796a937fd46a4f1870937dc` — `Remediate AI Arman dev dependency vulnerabilities`

The apply gate explicitly required both of these commands to succeed after the lockfile update:

```bash
npm audit --omit=dev --audit-level=low
npm audit --audit-level=low
```

## Verified audit result

After both verified lockfile remediations:

- Runtime audit: **0 vulnerabilities**
- Full audit: **0 vulnerabilities**
- `package.json` remained unchanged.
- No major dependency upgrade was introduced.

All temporary audit workflows and machine-generated JSON reports were removed after the remediation work.

Cleanup commit:

- `3616e4bd7aa624580a230e9cc5e3f03b6ba89fdf` — `Clean up temporary AI Arman dependency audit files`

## Safety state remains unchanged

This security audit does **not** authorize a rollout.

The beta0 safety state remains:

- private Cloud Run service only
- widget preview OFF
- model interpretation OFF
- model shadow OFF
- model promotion OFF
- no public AI Arman
- no customer UI rollout
- no order/tracking rollout
- no PR merge

## Next gate

The next gate is the normal AI Arman foundation CI on the clean branch tree after this documentation commit. It must verify the test suite, TypeScript build, and candidate container/smoke path before the dependency-security phase is considered closed.

After that gate is green, the next project phase is an authenticated remote smoke test against the existing **private** beta0 Cloud Run service. The service must not be made public for that test.
