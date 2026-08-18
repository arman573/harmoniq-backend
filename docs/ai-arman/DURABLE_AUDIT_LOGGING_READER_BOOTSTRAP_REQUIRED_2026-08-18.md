# AI Arman durable audit log reader bootstrap required — 2026-08-18

## Why this checkpoint exists

The read-only workflow `AI Arman durable audit logging IAM preflight` ran successfully and proved that the dedicated telemetry service account does **not** currently have `logging.logEntries.list`.

Latest evidence at creation of this checkpoint:

- workflow run: `32163657440`
- source commit: `a41e6034dcf57878f8f7