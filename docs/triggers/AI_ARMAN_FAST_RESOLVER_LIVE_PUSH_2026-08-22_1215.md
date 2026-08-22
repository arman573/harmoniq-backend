# AI Arman fast resolver stable-tag trigger

Trigger after converting the registered resolver deployment workflow from pull_request to exact branch push. The workflow must authenticate through WIF using ref refs/heads/ops/ai-arman-resolver-candidate-20260820, test/build the exact pushed source, deploy a private zero-traffic candidate, verify HQR-2494077 read-only behavior and latency, block unapproved execute, preserve positive production traffic, and only then move the existing stable resolver tag.
