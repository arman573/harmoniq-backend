# AI Arman – customer gateway secret-reference inventory

- Recorded at: 2026-08-19T14:14:51Z
- Source commit: `5d23349e75875cef423e7e22192a53bdd4e3baef`
- Inventory mode: **read-only GCP configuration metadata**
- Secret/plain values: **not read and not written to this document**

## Runtime identities

- AI Arman runtime: `ai-arman-beta0-runtime@harmoniq-210513.iam.gserviceaccount.com`
- Returns runtime: `222024985388-compute@developer.gserviceaccount.com`

## AI Arman service selected env sources

- `VENDRE_API_BASE_URL`: source=`missing`, ref=`-`
- `VENDRE_API_KEY`: source=`missing`, ref=`-`
- `GMAIL_CLIENT_ID`: source=`missing`, ref=`-`
- `GMAIL_CLIENT_SECRET`: source=`missing`, ref=`-`
- `GMAIL_REFRESH_TOKEN`: source=`missing`, ref=`-`
- `GMAIL_OUTBOUND_EMAIL`: source=`missing`, ref=`-`
- `GMAIL_INBOUND_EMAIL`: source=`missing`, ref=`-`
- `AI_ARMAN_CUSTOMER_SESSION_SECRET`: source=`missing`, ref=`-`

## Returns service selected env sources

- `VENDRE_API_BASE_URL`: source=`plain_value`, ref=`[redacted]`
- `VENDRE_API_KEY`: source=`secret_ref`, ref=`VENDRE_API_KEY`
- `GMAIL_CLIENT_ID`: source=`secret_ref`, ref=`GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`: source=`secret_ref`, ref=`GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`: source=`secret_ref`, ref=`GMAIL_REFRESH_TOKEN`
- `GMAIL_OUTBOUND_EMAIL`: source=`plain_value`, ref=`[redacted]`
- `GMAIL_INBOUND_EMAIL`: source=`plain_value`, ref=`[redacted]`

This inventory intentionally records only whether a selected variable is missing, plain/redacted, or backed by a named Secret Manager reference. No secret values are emitted.
