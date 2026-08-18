# AI Arman durable model shadow telemetry foundation — 2026-08-18

## Purpose

Provide durable, cross-instance model-shadow evidence without allowing telemetry to become customer authority and without logging customer content or sensitive business data.

## Current implementation state

Foundation code exists on `feature/ai-arman-foundation-v1` but durable model-shadow logging is **default OFF**.

Environment gate:

`AI_ARMAN_MODEL_SHADOW_DURABLE_AUDIT_ENABLED=true`

Until that exact flag is explicitly enabled on a separately verified candidate/live-shadow revision, the structured durable sink writes nothing.

## Durable event transport

The foundation writes one JSON object per shadow audit event to process stdout. Cloud Run captures container stdout/stderr in Cloud Logging, so this avoids adding a Google Cloud Logging SDK, API client, credential file, secret or runtime write role to the application.

Event name:

`ai_arman_model_shadow_audit`

Schema version:

`1`

## Privacy allowlist

Only these fields are allowed in the durable event:

- `severity`
- `event`
- `schemaVersion`
- `recordedAt`
- `provider`
- `modelVersion`
- `promptVersion`
- `status`
- `latencyMs`
- `inputTokens`
- `outputTokens`
- `totalTokens`
- `estimatedCostUsd`
- `candidateValid`
- `primaryIntentMatch`

The durable sink does not accept or serialize arbitrary request objects.

It must never contain:

- customer message text
- model response text
- email address
- phone number
- customer ID
- order ID/order number
- return/case ID
- parcel/tracking number
- product names/SKUs/IDs
- addresses
- payment data
- raw prompts
- raw provider responses
- authentication tokens or secrets

Regression tests deliberately contaminate an audit object with example private fields and verify those values never appear in the structured log line.

## Fail-safe architecture

`ChatInterpretationShadowOrchestrator` still records through `ChatInterpretationShadowAuditSink` and already catches audit failures.

The module now resolves that abstract sink to `CompositeChatInterpretationShadowAuditSink`:

1. existing in-memory store receives the event;
2. durable structured logger receives the same privacy-safe audit record only when its independent env gate is enabled;
3. failure in either sink is swallowed by the composite and can never alter the deterministic customer-facing path.

The in-memory store remains available for existing tests/debug behavior.

## What this does NOT change

This foundation does not:

- enable model promotion;
- increase live-shadow traffic above 1%;
- enable widget/public customer AI;
- change provider budgets, token limits, rate limits or concurrency;
- change Cloud Run IAM;
- add Cloud Logging writer roles;
- add secrets;
- log customer/model free text;
- authorize refunds, returns, replacements, order changes or any write action.

## Activation gate before any live enablement

Do not enable `AI_ARMAN_MODEL_SHADOW_DURABLE_AUDIT_ENABLED` until all of the following are separately proven:

1. exact-head foundation CI passes unit tests, TypeScript build, isolated candidate container build and smoke;
2. durable sink unit tests pass;
3. candidate revision stays private;
4. model promotion remains `false`;
5. widget preview remains `false`;
6. live traffic remains 99% deterministic / 1% shadow;
7. structured log entry is verified to contain only the allowlisted schema;
8. Cloud Logging query can retrieve the event across revision instances;
9. no customer/model content is present in the log entry;
10. rollback remains available and no telemetry failure can affect deterministic responses.

Activation itself requires a separate explicit production/candidate decision. This document is not approval to enable the flag.

## Evidence already established before this foundation

Read-only telemetry run `32160653663` verified:

- live boundary success;
- telemetry least privilege success;
- Cloud Monitoring metrics success;
- traffic 99% deterministic / 1% shadow;
- service max instances 2;
- model promotion false;
- widget preview false;
- telemetry identity has `monitoring.timeSeries.list`;
- no obvious write/secret permissions on the telemetry identity;
- deterministic 5xx 0;
- shadow 5xx 0;
- no Cloud Run traffic/config/IAM mutation by the telemetry workflow.

That infrastructure telemetry is separate from model-quality evidence. The durable audit foundation is intended to close the cross-instance/process-lifetime evidence gap before any future promotion discussion.
