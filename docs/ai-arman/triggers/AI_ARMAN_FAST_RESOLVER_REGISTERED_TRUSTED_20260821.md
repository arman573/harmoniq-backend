# Trigger: registered trusted fast resolver deploy

Uses the existing registered workflow identity that has previously been accepted by Google WIF.

Frozen optimized source: `c7374c21708869d4c893bbd09b3f20865db8f547`

Required gates before the stable resolver tag can move:
- source tests and build pass,
- private IAM remains intact,
- current stable config is preserved,
- real verified case/order prepare succeeds without writes,
- legacy greeting/signature wrapper is absent,
- execute without explicit approval remains blocked,
- warm prepare is at most 12 seconds,
- positive production Cloud Run traffic is unchanged,
- no customer message is sent,
- autonomous sending remains disabled.
