# Trigger: deploy AI Arman fast resolver stable tag

Safe one-off deployment trigger for the optimized resolver path.

Guards:
- build and tests must pass,
- real case/order prepare must pass,
- analysis and reply must come from the optimized combined path,
- legacy greeting/signature wrappers must be absent,
- execute without approval must remain blocked,
- no supported real write is executed,
- no customer message is sent,
- autonomous sending remains disabled,
- positive production Cloud Run traffic must remain unchanged,
- the existing stable resolver tag is moved only after all gates pass.
