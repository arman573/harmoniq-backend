import { Injectable } from '@nestjs/common';

@Injectable()
export class AiArmanInternalPreviewPageService {
  render(): string {
    return `<!doctype html>
<html lang="sv">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow,noarchive" />
  <title>AI Arman intern testyta</title>
  <style>
    :root { font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: #171717; background: #f5f5f3; }
    * { box-sizing: border-box; }
    body { margin: 0; }
    main { max-width: 980px; margin: 0 auto; padding: 32px 18px 56px; }
    h1 { margin: 0 0 8px; font-size: clamp(28px, 5vw, 48px); letter-spacing: -.04em; }
    .lead { color: #666; line-height: 1.6; margin: 0 0 24px; }
    .panel { background: #fff; border: 1px solid #ddd; border-radius: 18px; padding: 18px; margin-bottom: 18px; }
    textarea { width: 100%; min-height: 120px; resize: vertical; border: 1px solid #ccc; border-radius: 14px; padding: 13px; font: inherit; }
    button { margin-top: 10px; border: 0; border-radius: 12px; padding: 11px 16px; background: #111; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
    button:disabled { opacity: .5; cursor: default; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .card { border: 1px solid #e2e2df; border-radius: 14px; padding: 14px; background: #fafaf8; }
    .label { color: #777; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; }
    .value { margin-top: 4px; font-weight: 750; overflow-wrap: anywhere; }
    .ok { color: #146c2e; }
    .bad { color: #a12622; }
    .response { white-space: pre-wrap; line-height: 1.5; }
    .status { min-height: 20px; color: #666; margin-top: 8px; font-size: 13px; }
    @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
<main>
  <h1>AI Arman – intern testyta</h1>
  <p class="lead">Privat diagnostikvy för att jämföra modellens tolkning med backendens beslut. Rå modelltext, prompts och secrets visas inte.</p>

  <section class="panel">
    <label for="question"><strong>Din fråga</strong></label>
    <textarea id="question" maxlength="2000" placeholder="Skriv en fråga till AI Arman…"></textarea>
    <button id="run" type="button">Kör test</button>
    <div class="status" id="status"></div>
  </section>

  <section class="panel" id="results" hidden>
    <div class="grid">
      <div class="card"><div class="label">AI intent</div><div class="value" id="modelIntent">–</div></div>
      <div class="card"><div class="label">Backend intent</div><div class="value" id="backendIntent">–</div></div>
      <div class="card"><div class="label">Match</div><div class="value" id="match">–</div></div>
      <div class="card"><div class="label">AI confidence</div><div class="value" id="confidence">–</div></div>
      <div class="card"><div class="label">Provider status</div><div class="value" id="providerStatus">–</div></div>
      <div class="card"><div class="label">Tokens / kostnad</div><div class="value" id="usage">–</div></div>
      <div class="card"><div class="label">Backend route</div><div class="value" id="route">–</div></div>
      <div class="card"><div class="label">Authority</div><div class="value" id="authority">–</div></div>
      <div class="card"><div class="label">Promotion</div><div class="value" id="promotion">–</div></div>
      <div class="card"><div class="label">Writes</div><div class="value" id="writes">–</div></div>
    </div>
  </section>

  <section class="panel" id="answerPanel" hidden>
    <div class="label">Säkert backend-svar</div>
    <div class="response" id="answer"></div>
  </section>
</main>
<script>
(() => {
  'use strict';
  const question = document.getElementById('question');
  const run = document.getElementById('run');
  const status = document.getElementById('status');
  const results = document.getElementById('results');
  const answerPanel = document.getElementById('answerPanel');
  let sequence = 0;

  function setText(id, value) {
    document.getElementById(id).textContent = value == null ? '–' : String(value);
  }
  function firstMessage(blocks) {
    if (!Array.isArray(blocks)) return '';
    const block = blocks.find((item) => item && (item.type === 'message' || item.type === 'question') && typeof item.text === 'string');
    return block ? block.text : '';
  }

  run.addEventListener('click', async () => {
    const text = String(question.value || '').trim();
    if (!text) return;
    sequence += 1;
    run.disabled = true;
    status.textContent = 'Kör diagnostik…';
    results.hidden = true;
    answerPanel.hidden = true;

    try {
      const response = await fetch('/ai-arman/internal-preview/diagnostics', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', 'accept': 'application/json' },
        body: JSON.stringify({
          contractVersion: 'ai-arman-chat-v1',
          clientMessageId: 'internal-preview-' + Date.now().toString(36) + '-' + sequence.toString(36),
          message: { text },
          context: { locale: 'sv-SE', channel: 'internal_preview' }
        })
      });
      if (!response.ok) throw new Error('diagnostics_failed_' + response.status);
      const data = await response.json();
      const model = data.modelShadow || {};
      const deterministic = data.deterministic || {};
      const safety = data.safety || {};
      const totalTokens = model.totalTokens == null ? '–' : String(model.totalTokens);
      const cost = model.estimatedCostUsd == null ? '–' : '$' + Number(model.estimatedCostUsd).toFixed(6);

      setText('modelIntent', model.primaryIntent);
      setText('backendIntent', deterministic.primaryIntent);
      setText('match', model.primaryIntentMatch == null ? '–' : (model.primaryIntentMatch ? 'JA' : 'NEJ'));
      setText('confidence', model.confidence == null ? '–' : Math.round(Number(model.confidence) * 100) + '%');
      setText('providerStatus', model.providerStatus);
      setText('usage', totalTokens + ' tokens · ' + cost);
      setText('route', deterministic.backendRoute);
      setText('authority', deterministic.backendAuthority);
      setText('promotion', safety.promotionEnabled ? 'PÅ' : 'AV');
      setText('writes', safety.writesExecuted ? 'JA' : 'NEJ');
      setText('answer', firstMessage(data.response && data.response.blocks));

      document.getElementById('match').className = 'value ' + (model.primaryIntentMatch === true ? 'ok' : model.primaryIntentMatch === false ? 'bad' : '');
      document.getElementById('promotion').className = 'value ' + (safety.promotionEnabled ? 'bad' : 'ok');
      document.getElementById('writes').className = 'value ' + (safety.writesExecuted ? 'bad' : 'ok');
      results.hidden = false;
      answerPanel.hidden = false;
      status.textContent = 'Klart.';
    } catch (_) {
      status.textContent = 'Diagnostiken kunde inte köras. Ingen osäker data visas.';
    } finally {
      run.disabled = false;
    }
  });
})();
</script>
</body>
</html>`;
  }
}
