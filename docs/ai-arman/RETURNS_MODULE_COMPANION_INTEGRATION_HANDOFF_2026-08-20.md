# AI Arman companion integration handoff for returns module

## Goal
Embed the compact AI Arman admin companion into the returns/reclamation admin UI without moving AI logic into the returns module.

Ownership must stay split:
- Returns module owns case UI, case data, admin authentication, GCS/Vendre/mail workflows and all business writes.
- AI Arman owns case understanding, solution reasoning, multi-turn admin discussion and approved support learning.
- AI Arman must never send customer messages or execute external writes from the companion contract.

## Verified AI Arman candidate
- Source: `6076a18c5a43b9bd83608becb7bfd0df813db9e2`
- Revision: `harmoniq-ai-arman-beta0-acv3-6076a18c-1`
- Candidate traffic: 0%
- Production AI Arman traffic remained 99/1
- Service remained private
- Drawer max width: 410 px
- Analysis latency: 9s
- Discussion latency: 4s
- Multi-turn discussion: PASS
- Customer message sending: false
- External writes: false
- Learning writes: OFF in candidate
- Evidence: `docs/ai-arman/ADMIN_COMPANION_V3_CANDIDATE_LATEST.md`

## Important: do not rebuild service-to-service auth
The returns module already has a private Cloud Run service-to-service integration pattern in:
- `server/src/routes/adminAiArmanReplyDraft.js`
- `server/src/routes/adminAiArmanReadiness.js`
- registration in `server/src/index-gcs-admin.js`

That route already:
- reads the real case from GCS on the server,
- excludes internal-only outbound messages,
- redacts email before AI calls,
- mints a Cloud Run identity token,
- separates request URL from canonical audience,
- fails closed if disabled or misconfigured.

Reuse that pattern. Do not expose AI Arman directly to the browser and do not make the AI Arman Cloud Run service public.

## Existing UI to replace, not extend
Current returns branch `feature/unified-order-case-inbox` already renders:
- `src/features/admin/OrderCaseCommunication.jsx`
- `src/features/admin/AiArmanReplyDraftPanel.jsx`
- `src/services/adminAiArmanService.js`

`OrderCaseCommunication.jsx` currently mounts `<AiArmanReplyDraftPanel cases={cases} />` inside **Gemensam kommunikation**.

The old panel is large and reply-draft oriented. Replace it with a compact launcher/drawer integration rather than stacking the new companion on top of it.

## Recommended UX
Closed state:
- one compact `AI Arman` button in/near Gemensam kommunikation.

Open state:
- right-side drawer, max 410 px on desktop,
- full width on small screens,
- tabs: `Förstå`, `Lös`, `Diskutera`,
- do not expand the main case card vertically,
- do not auto-open for every case,
- preserve admin scroll position.

Analysis view:
- summary,
- customer need,
- recommended next steps,
- missing verified facts,
- human-decision warning when needed.

Discussion view:
- multi-turn conversation with AI Arman about the same case,
- keep max 12 turns client-side for the request contract,
- learning candidate can be shown, but saving must remain a separate explicit admin action.

## AI Arman API contract
Version constant now exists in AI Arman:
`src/ai-arman/admin/admin-companion.contract.ts`

Contract version:
`ai-arman-admin-companion-v1`

Request shape:
```json
{
  "contractVersion": "ai-arman-admin-companion-v1",
  "caseId": "HQR-...",
  "caseType": "claim",
  "status": "waiting_review",
  "customerName": "Anna",
  "messages": [
    {
      "direction": "inbound",
      "sender": "Kund",
      "subject": "",
      "text": "...",
      "date": "2026-08-20T10:00:00Z"
    }
  ],
  "adminQuestion": "",
  "discussion": []
}
```

For first analysis, omit/empty `adminQuestion`.

Analysis response:
```json
{
  "ok": true,
  "mode": "analysis",
  "caseSummary": "...",
  "customerNeed": "...",
  "recommendedActions": ["..."],
  "reasoning": "...",
  "requiresHumanDecision": false,
  "missingFacts": ["..."],
  "approvedLearningsUsed": 0,
  "sendsCustomerMessage": false,
  "executesWrites": false
}
```

For discussion, send `adminQuestion` and recent `discussion` turns.

Discussion response:
```json
{
  "ok": true,
  "mode": "discussion",
  "answerToAdmin": "...",
  "requiresHumanDecision": false,
  "learningCandidate": null,
  "approvedLearningsUsed": 0,
  "sendsCustomerMessage": false,
  "executesWrites": false
}
```

## Minimal returns-module implementation
Prefer these small changes only:

1. Replace the old `AiArmanReplyDraftPanel` mount in `OrderCaseCommunication.jsx` with a compact companion launcher component.
2. Add a small React component, suggested name `AiArmanCaseCompanion.jsx`, responsible only for drawer state and rendering.
3. Extend `src/services/adminAiArmanService.js` with `analyzeCase` / `discussCase` calls to a returns-backend proxy route.
4. Extend the existing server-side AI Arman proxy pattern so the browser sends only the selected `caseId`, admin question and recent discussion. The server must load the authoritative case itself and construct the AI request.
5. Keep the existing customer-send route completely separate. Companion responses are advisory only.
6. Do not enable learning writes yet unless AI Arman gets its own approved durable storage configuration. Showing a learning suggestion is fine; persisting it is a later explicit step.

## Recommended proxy route shape
Suggested returns API routes:
- `POST /api/admin/cases/:caseId/ai-arman/analyze`
- `POST /api/admin/cases/:caseId/ai-arman/discuss`

Browser payload for analysis should be empty or minimal. Browser payload for discussion:
```json
{
  "question": "Hur skulle du lösa detta?",
  "discussion": [
    { "role": "assistant", "text": "..." },
    { "role": "admin", "text": "..." }
  ]
}
```

The returns backend must ignore browser-supplied case facts and always load the actual case from GCS before calling AI Arman.

## Safety invariants for returns integration
- Never let browser-provided order/case facts override backend facts.
- Never expose OpenAI keys or private AI service credentials to the browser.
- Never make AI Arman public just to support the admin UI.
- Never send customer email from the companion endpoint.
- Never mutate case status, refund, replacement, goodwill, Vendre data, GCS case data or shipping from a companion response.
- `requiresHumanDecision=true` must be visible when present.
- All model text rendered with React text nodes / `textContent`; no model HTML.

## What the returns-module chat should test
- Existing case list/expand/collapse remains stable.
- AI button is compact and does not expand the communication card when closed.
- Drawer is <=410 px desktop and full width mobile.
- Analyze uses the correct selected HQR case.
- Internal-only messages are not sent to AI.
- Follow-up discussion includes previous turns.
- Analyze/discuss errors fail locally without breaking admin case rendering.
- No customer send happens from analyze/discuss.
- Existing manual/admin customer reply path still behaves exactly as before.
- Frontend build and full server tests pass.

## Current recommendation
Do not implement the UI from the AI Arman chat. Let the returns-module chat own the small React/proxy changes because it is already changing that module. AI Arman should only maintain the stable companion contract and its private reasoning backend.
