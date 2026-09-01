# AI Arman admin reply recovery candidate trigger

- Functional application source before this docs-only trigger: `df0b13d2f5a8d5d4254f91369e5b543602f5637a`
- Purpose: build and deploy the current recovery implementation as a zero-traffic AI Arman admin reply candidate using the existing canonical candidate workflow.
- Required traffic: `0%` for the new candidate.
- Production traffic must remain unchanged.
- No IAM mutation is intended.
- No customer message, Returns/Vendre/Gmail/nShift write, or production cutover is intended.
- After candidate PASS, the next gate is the real `HQR-2493528` read-only reply-draft through the Returns zero-traffic candidate.
