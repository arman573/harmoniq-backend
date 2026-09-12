# AI Arman – customer gateway IAM preflight

- Recorded at: 2026-08-19T14:19:11Z
- Source commit: `25d60af4fdfbb44301a802d684aa15a4d6bdf9e7`
- Active identity: `github-ai-arman-deployer@harmoniq-210513.iam.gserviceaccount.com`
- Mode: **permission tests and IAM metadata reads only; no mutation**

## Project-level deployer permissions

- `run.services.create`: **yes**
- `run.services.get`: **yes**
- `run.services.update`: **yes**
- `iam.serviceAccounts.create`: **no**
- `resourcemanager.projects.setIamPolicy`: **no**
- `secretmanager.secrets.create`: **no**

## Existing AI runtime service-account permissions available to deployer

- testIamPermissions HTTP: `200`
- `iam.serviceAccounts.actAs`: **yes**
- `iam.serviceAccounts.getIamPolicy`: **no**
- `iam.serviceAccounts.setIamPolicy`: **no**

## Reference Secret Manager permissions on `VENDRE_API_KEY`

- testIamPermissions HTTP: `200`
- `secretmanager.secrets.getIamPolicy`: **no**
- `secretmanager.secrets.setIamPolicy`: **no**
- `secretmanager.versions.add`: **no**
- `secretmanager.versions.access`: **no**

## Existing runtime secret-access metadata

- project IAM readable: **unknown**
- existing AI runtime has project-level secretAccessor binding: **unknown**
- reference secret IAM readable: **unknown**
- existing AI runtime has secret-level accessor binding on reference secret: **unknown**

No IAM policy, service account, Secret Manager secret/version, Cloud Run service, or traffic setting was changed by this preflight.
