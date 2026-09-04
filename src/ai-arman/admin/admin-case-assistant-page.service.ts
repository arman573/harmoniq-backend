import { Injectable } from '@nestjs/common';

@Injectable()
export class AiArmanAdminCaseAssistantPageService {
  render(options: { learningEnabled: boolean }): string {
    const learningEnabled = options.learningEnabled ? 'true' : 'false';
    return `<!doctype html>
<html lang="sv">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow,noarchive" />
  <title>AI Arman · Ärendeassistent</title>
  <style>
    :root { font-family: Inter, ui-sans-serif, system-ui, sans-serif; color:#171717; background:#f7f4f1; }
    * { box-sizing:border-box; }
    body { margin:0; min-height:100vh; }
    .demo { min-height:100vh; padding:28px; color:#777; }
    .launcher { position:fixed; right:18px; bottom:18px; border:0; border-radius:999px; padding:12px 16px; background:#8b1538; color:#fff; font-weight:800; cursor:pointer; box-shadow:0 8px 28px rgba(0,0,0,.18); }
    .drawer { position:fixed; top:12px; right:12px; bottom:12px; width:min(410px,calc(100vw - 24px)); background:#fff; border:1px solid #eadfda; border-radius:20px; box-shadow:0 18px 60px rgba(46,27,20,.18); display:flex; flex-direction:column; overflow:hidden; transform:translateX(calc(100% + 28px)); transition:transform .18s ease; }
    .drawer.open { transform:translateX(0); }
    .head { padding:14px 14px 10px; border-bottom:1px solid #eee5e1; }
    .headrow { display:flex; align-items:center; justify-content:space-between; gap:10px; }
    .brand { display:flex; align-items:center; gap:9px; min-width:0; }
    .avatar { width:34px; height:34px; border-radius:50%; display:grid; place-items:center; background:#8b1538; color:#fff; font-weight:900; }
    .title { font-weight:850; line-height:1.05; }
    .sub { margin-top:3px; color:#7c6b64; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:260px; }
    .iconbtn { border:0; background:#f5efec; width:32px; height:32px; border-radius:10px; cursor:pointer; }
    .tabs { display:grid; grid-template-columns:repeat(3,1fr); gap:5px; padding:9px 12px 0; }
    .tab { border:0; border-radius:10px; padding:8px 6px; background:#f7f3f1; color:#6d5a52; font-weight:750; cursor:pointer; }
    .tab.active { background:#8b1538; color:#fff; }
    .body { flex:1; overflow:auto; padding:12px; }
    .setup { border:1px dashed #d9cbc5; border-radius:14px; padding:11px; margin-bottom:10px; background:#fcfaf9; }
    .setup summary { cursor:pointer; font-weight:750; font-size:13px; }
    .row { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:9px; }
    input, textarea, select { width:100%; border:1px solid #d9ceca; border-radius:11px; padding:10px; font:inherit; background:#fff; }
    textarea { resize:vertical; min-height:86px; }
    .messages { min-height:130px; font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px; }
    .primary { border:0; border-radius:11px; padding:10px 12px; background:#8b1538; color:#fff; font-weight:800; cursor:pointer; }
    .secondary { border:1px solid #d8cbc5; border-radius:11px; padding:9px 11px; background:#fff; color:#4d3d37; font-weight:750; cursor:pointer; }
    .card { border:1px solid #eee3df; border-radius:14px; padding:12px; margin-bottom:9px; background:#fffdfc; }
    .label { color:#8a7369; font-size:11px; text-transform:uppercase; letter-spacing:.06em; font-weight:850; }
    .text { margin-top:5px; line-height:1.45; white-space:pre-wrap; }
    ol { margin:7px 0 0 18px; padding:0; }
    li { margin:5px 0; line-height:1.35; }
    .warn { background:#fff6df; border-color:#ecd28c; }
    .chatlog { display:flex; flex-direction:column; gap:8px; }
    .bubble { max-width:92%; padding:9px 11px; border-radius:13px; line-height:1.4; white-space:pre-wrap; }
    .me { align-self:flex-end; background:#8b1538; color:#fff; }
    .ai { align-self:flex-start; background:#f4efec; }
    .composer { border-top:1px solid #eee5e1; padding:10px 12px 12px; background:#fff; }
    .composeRow { display:grid; grid-template-columns:1fr auto; gap:8px; align-items:end; }
    .composeRow textarea { min-height:46px; max-height:130px; }
    .status { min-height:18px; color:#7c6b64; font-size:12px; margin-top:7px; }
    .learn { margin-top:9px; border-top:1px solid #eee3df; padding-top:9px; }
    .learn[hidden], .panel[hidden] { display:none; }
    .tiny { font-size:11px; color:#8a7369; line-height:1.35; }
    @media (max-width:560px) { .drawer { top:0; right:0; bottom:0; width:100vw; border-radius:0; } .demo{padding:18px;} }
  </style>
</head>
<body>
  <div class="demo">AI Arman är en separat ärendeassistent. Den här candidate-vyn ändrar inga externa moduler.</div>
  <button class="launcher" id="launcher">AI Arman</button>
  <aside class="drawer" id="drawer" aria-label="AI Arman ärendeassistent">
    <header class="head">
      <div class="headrow">
        <div class="brand"><div class="avatar">A</div><div><div class="title">AI Arman</div><div class="sub" id="caseLabel">Ingen ärendekontext vald</div></div></div>
        <button class="iconbtn" id="close" aria-label="Stäng">×</button>
      </div>
    </header>
    <nav class="tabs">
      <button class="tab active" data-tab="understand">Förstå</button>
      <button class="tab" data-tab="solve">Lös</button>
      <button class="tab" data-tab="discuss">Diskutera</button>
    </nav>
    <main class="body">
      <details class="setup" id="setup" open>
        <summary>Ärendekontext</summary>
        <div class="row"><input id="caseId" placeholder="HQR-..." /><select id="caseType"><option value="support">Support</option><option value="return">Retur</option><option value="claim">Reklamation</option><option value="wrong_item">Fel vara</option><option value="missing_item">Saknad vara</option></select></div>
        <div class="row"><input id="statusInput" placeholder="Status" /><input id="customerName" placeholder="Förnamn, valfritt" /></div>
        <textarea class="messages" id="messages" placeholder='Meddelanden som JSON, t.ex. [{"direction":"inbound","sender":"Kund","text":"..."}]'></textarea>
        <button class="primary" id="analyze">Analysera ärendet</button>
        <div class="tiny">AI Arman läser bara den kontext du ger honom. E-post redigeras bort innan modell-anrop.</div>
      </details>

      <section class="panel" id="understandPanel">
        <div class="card"><div class="label">Sammanfattning</div><div class="text" id="summary">Analysera ett ärende för att börja.</div></div>
        <div class="card"><div class="label">Kundens behov</div><div class="text" id="need">–</div></div>
        <div class="card" id="missingCard" hidden><div class="label">Saknade fakta</div><ol id="missing"></ol></div>
      </section>

      <section class="panel" id="solvePanel" hidden>
        <div class="card"><div class="label">Rekommenderade nästa steg</div><ol id="actions"></ol></div>
        <div class="card"><div class="label">Varför</div><div class="text" id="reasoning">–</div></div>
        <div class="card warn" id="humanCard" hidden><div class="label">Mänskligt beslut krävs</div><div class="text">AI Arman kan resonera och föreslå, men får inte fatta detta beslut.</div></div>
      </section>

      <section class="panel" id="discussPanel" hidden>
        <div class="chatlog" id="chatlog"></div>
        <div class="learn" id="learnBox" hidden>
          <div class="label">Föreslagen lärdom</div>
          <div class="text" id="learnText"></div>
          <button class="secondary" id="approveLearn">Godkänn och lär AI Arman</button>
          <div class="tiny">Inget lärande sparas utan ditt uttryckliga godkännande.</div>
        </div>
      </section>
    </main>
    <footer class="composer" id="composer" hidden>
      <div class="composeRow"><textarea id="question" placeholder="Diskutera lösningen med AI Arman…"></textarea><button class="primary" id="send">Skicka</button></div>
      <div class="status" id="status"></div>
    </footer>
  </aside>
<script>
(() => {
  'use strict';
  const learningEnabled = ${learningEnabled};
  const $ = (id) => document.getElementById(id);
  const state = { result:null, learning:null, tab:'understand', discussion:[] };
  $('launcher').onclick = () => $('drawer').classList.add('open');
  $('close').onclick = () => $('drawer').classList.remove('open');
  document.querySelectorAll('.tab').forEach((button) => button.onclick = () => selectTab(button.dataset.tab));

  function selectTab(tab) {
    state.tab = tab;
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    $('understandPanel').hidden = tab !== 'understand';
    $('solvePanel').hidden = tab !== 'solve';
    $('discussPanel').hidden = tab !== 'discuss';
    $('composer').hidden = tab !== 'discuss';
  }
  function context(adminQuestion='') {
    let messages = [];
    try { messages = JSON.parse($('messages').value || '[]'); } catch (_) { throw new Error('Meddelanden måste vara giltig JSON.'); }
    if (!Array.isArray(messages)) throw new Error('Meddelanden måste vara en lista.');
    return { caseId:$('caseId').value.trim(), caseType:$('caseType').value, status:$('statusInput').value.trim(), customerName:$('customerName').value.trim(), messages, adminQuestion, discussion:state.discussion.slice(-12) };
  }
  async function run(question='') {
    $('status').textContent = 'AI Arman tänker…';
    try {
      const response = await fetch('/ai-arman/internal/admin-assistant/assist', { method:'POST', credentials:'same-origin', headers:{'content-type':'application/json','accept':'application/json'}, body:JSON.stringify(context(question)) });
      const data = await response.json();
      if (!response.ok || data.ok !== true) throw new Error(data.code || 'assistant_failed');
      state.result = data; state.learning = data.learningCandidate || null;
      if (question) state.discussion.push({ role:'admin', text:question });
      state.discussion.push({ role:'assistant', text:data.answerToAdmin });
      state.discussion = state.discussion.slice(-12);
      render(data, question);
      $('setup').open = false;
      $('caseLabel').textContent = ($('caseId').value.trim() || 'Ärende') + ' · ' + $('caseType').value;
      $('status').textContent = 'Klart.';
    } catch (error) { $('status').textContent = error instanceof Error ? error.message : 'AI Arman kunde inte analysera ärendet.'; }
  }
  function render(data, question) {
    $('summary').textContent = data.caseSummary;
    $('need').textContent = data.customerNeed;
    fillList($('actions'), data.recommendedActions);
    $('reasoning').textContent = data.reasoning;
    $('humanCard').hidden = !data.requiresHumanDecision;
    fillList($('missing'), data.missingFacts);
    $('missingCard').hidden = !data.missingFacts.length;
    if (question) addBubble('me', question);
    addBubble('ai', data.answerToAdmin);
    if (state.learning && learningEnabled) {
      $('learnText').textContent = state.learning.principle;
      $('learnBox').hidden = false;
    } else $('learnBox').hidden = true;
  }
  function fillList(node, items) {
    node.replaceChildren();
    (Array.isArray(items) ? items : []).forEach((text) => { const li=document.createElement('li'); li.textContent=text; node.appendChild(li); });
  }
  function addBubble(kind, text) { const div=document.createElement('div'); div.className='bubble '+kind; div.textContent=text; $('chatlog').appendChild(div); }
  function resetDiscussion() { state.discussion = []; state.learning = null; $('chatlog').replaceChildren(); $('learnBox').hidden = true; }

  $('analyze').onclick = () => { resetDiscussion(); run(''); };
  $('send').onclick = async () => { const q=$('question').value.trim(); if(!q)return; $('question').value=''; await run(q); selectTab('discuss'); };
  $('approveLearn').onclick = async () => {
    if (!state.learning || !learningEnabled) return;
    $('approveLearn').disabled = true; $('status').textContent = 'Sparar godkänd lärdom…';
    try {
      const payload = { approved:true, createdBy:'admin', caseType:$('caseType').value, ...state.learning };
      const response = await fetch('/ai-arman/internal/admin-assistant/learn', { method:'POST', credentials:'same-origin', headers:{'content-type':'application/json','accept':'application/json'}, body:JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok || data.ok !== true) throw new Error(data.code || 'learning_failed');
      $('learnBox').hidden = true; state.learning = null; $('status').textContent = 'Lärdomen är sparad och godkänd.';
    } catch (error) { $('status').textContent = error instanceof Error ? error.message : 'Lärdomen kunde inte sparas.'; }
    finally { $('approveLearn').disabled = false; }
  };
})();
</script>
</body>
</html>`;
  }
}
