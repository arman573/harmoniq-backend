# Trigger: deploy AI Arman fast resolver via trusted branch

Deploys the frozen optimized resolver source through the trusted foundation branch WIF context.

Safety gates:
- all tests and build must pass,
- private Cloud Run boundary must remain private,
- stable resolver config must be preserved exactly,
- real prepare is read-only,
- legacy greeting/signature wrappers are rejected,
- execute without approval remains blocked,
- no supported real write is executed,
- no customer message is sent,
- autonomous sending stays disabled,
- positive production traffic must remain unchanged,
- the existing stable resolver tag moves only after all gates pass.