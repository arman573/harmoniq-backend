# AI Arman fast resolver live trigger

Triggered after the Workload Identity Provider was updated to allow the exact branch `refs/heads/ops/ai-arman-resolver-candidate-20260820` for `arman573/harmoniq-backend`.

This trigger is intended to run the guarded fast-resolver deploy workflow. The workflow must preserve positive production traffic, deploy a zero-traffic candidate first, run real read-only prepare verification, reject execute without explicit approval, verify no customer message/write, and only then move the existing stable resolver tag.
