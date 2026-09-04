import { Injectable } from '@nestjs/common';

@Injectable()
export class AiArmanWidgetPreviewService {
  render(): string {
    return `<!doctype html>
<html lang="sv">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="color-scheme" content="light" />
  <title>AI Arman Beta 0 Preview</title>
  <style>
    :root {
      font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #181818;
      background: #f6f3ef;
    }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: radial-gradient(circle at 50% 0%, #fff 0, #f6f3ef 48%, #eee8e1 100%); }
    button, textarea, input { font: inherit; }
    button { cursor: pointer; }
    .page { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    .preview-copy { max-width: 620px; text-align: center; }
    .preview-copy h1 { font-size: clamp(28px, 5vw, 52px); margin: 0 0 14px; letter-spacing: -0.04em; }
    .preview-copy p { margin: 0 auto; max-width: 560px; line-height: 1.6; color: #666; }
    .launcher {
      position: fixed; right: max(18px, env(safe-area-inset-right)); bottom: max(18px, env(safe-area-inset-bottom));
      border: 0; border-radius: 999px; padding: 14px 19px; background: #111; color: #fff;
      box-shadow: 0 14px 44px rgba(0,0,0,.2); font-weight: 700; z-index: 20;
    }
    .panel {
      position: fixed; right: max(16px, env(safe-area-inset-right)); bottom: max(76px, calc(env(safe-area-inset-bottom) + 76px));
      width: min(420px, calc(100vw - 24px)); height: min(680px, calc(100dvh - 110px));
      display: none; grid-template-rows: auto 1fr auto; background: rgba(255,255,255,.98);
      border: 1px solid rgba(0,0,0,.08); border-radius: 24px; overflow: hidden;
      box-shadow: 0 24px 80px rgba(31,24,18,.22); z-index: 19;
    }
    .panel.open { display: grid; }
    .header { display: flex; align-items: center; gap: 12px; padding: 16px 17px; border-bottom: 1px solid #eee; }
    .avatar { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 50%; background: #111; color: #fff; font-weight: 800; }
    .header-copy { flex: 1; min-width: 0; }
    .header-title { font-weight: 800; letter-spacing: -.02em; }
    .header-sub { margin-top: 2px; color: #777; font-size: 12px; }
    .close { border: 0; background: transparent; width: 38px; height: 38px; border-radius: 50%; font-size: 22px; color: #555; }
    .messages { overflow: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; scroll-behavior: smooth; }
    .bubble { max-width: 86%; padding: 11px 13px; border-radius: 17px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }
    .bubble.user { align-self: flex-end; background: #111; color: #fff; border-bottom-right-radius: 5px; }
    .bubble.assistant { align-self: flex-start; background: #f2f0ed; color: #222; border-bottom-left-radius: 5px; }
    .quick-replies { display: flex; flex-wrap: wrap; gap: 8px; align-self: flex-start; }
    .quick-reply { border: 1px solid #d8d3ce; background: #fff; border-radius: 999px; padding: 9px 12px; color: #262626; }
    .card { border: 1px solid #e3dfda; border-radius: 16px; padding: 13px; background: #fff; box-shadow: 0 4px 16px rgba(0,0,0,.035); }
    .card-title { font-weight: 800; margin-bottom: 6px; }
    .card-meta { color: #666; font-size: 13px; line-height: 1.45; }
    .card a { color: inherit; font-weight: 700; }
    .notice { align-self: stretch; padding: 11px 13px; border-radius: 14px; background: #fff6df; border: 1px solid #eedaa6; font-size: 13px; }
    .composer { border-top: 1px solid #eee; padding: 12px; background: #fff; }
    .composer-row { display: flex; gap: 8px; align-items: flex-end; }
    textarea { flex: 1; min-height: 46px; max-height: 130px; resize: none; border: 1px solid #d8d3ce; border-radius: 15px; padding: 12px; outline: none; }
    textarea:focus { border-color: #777; box-shadow: 0 0 0 3px rgba(0,0,0,.05); }
    .send { border: 0; border-radius: 14px; min-width: 76px; height: 46px; background: #111; color: #fff; font-weight: 750; }
    .send:disabled { opacity: .45; cursor: default; }
    .status { min-height: 18px; padding: 5px 2px 0; color: #777; font-size: 11px; }
    @media (max-width: 520px) {
      .page { align-items: start; padding-top: 90px; }
      .panel { inset: 0; width: 100%; height: 100dvh; border: 0; border-radius: 0; }
      .launcher { right: 14px; bottom: max(14px, env(safe-area-inset-bottom)); }
    }
    @media (prefers-reduced-motion: reduce) { .messages { scroll-behavior: auto; } }
  </style>
</head>
<body>
  <main class="page">
    <section class="preview-copy">
      <h1>AI Arman Beta 0</h1>
      <p>Intern förhandsvisning av Harmoniqs kommande AI-rådgivare. Widgeten använder endast strukturerade backend-svar och visar inga fria HTML-svar från modellen.</p>
    </section>
  </main>

  <button class="launcher" id="launcher" type="button" aria-expanded="false" aria-controls="ai-arman-panel">Fråga AI Arman</button>
  <section class="panel" id="ai-arman-panel" aria-label="AI Arman chatt" aria-hidden="true">
    <header class="header">
      <div class="avatar" aria-hidden="true">A</div>
      <div class="header-copy">
        <div class="header-title">AI Arman</div>
        <div class="header-sub">Produktval, order och spårning · Beta 0</div>
      </div>
      <button class="close" id="close" type="button" aria-label="Stäng chatt">×</button>
    </header>
    <div class="messages" id="messages" aria-live="polite"></div>
    <form class="composer" id="composer">
      <div class="composer-row">
        <textarea id="input" maxlength="2000" rows="1" placeholder="Skriv vad du vill ha hjälp med…" aria-label="Meddelande till AI Arman"></textarea>
        <button class="send" id="send" type="submit">Skicka</button>
      </div>
      <div class="status" id="status" role="status"></div>
    </form>
  </section>

  <script>
  (() => {
    'use strict';
    const CONTRACT_VERSION = 'ai-arman-chat-v1';
    const endpoint = '/ai-arman/chat/messages';
    const launcher = document.getElementById('launcher');
    const panel = document.getElementById('ai-arman-panel');
    const close = document.getElementById('close');
    const messages = document.getElementById('messages');
    const form = document.getElementById('composer');
    const input = document.getElementById('input');
    const send = document.getElementById('send');
    const status = document.getElementById('status');
    let conversationId = null;
    let busy = false;
    let messageSequence = 0;

    function setOpen(open) {
      panel.classList.toggle('open', open);
      panel.setAttribute('aria-hidden', String(!open));
      launcher.setAttribute('aria-expanded', String(open));
      launcher.textContent = open ? 'Stäng AI Arman' : 'Fråga AI Arman';
      if (open) {
        if (!messages.childElementCount) renderWelcome();
        window.setTimeout(() => input.focus(), 0);
      }
    }

    function appendText(className, text) {
      const node = document.createElement('div');
      node.className = className;
      node.textContent = String(text || '');
      messages.appendChild(node);
      scrollToBottom();
      return node;
    }

    function renderWelcome() {
      appendText('bubble assistant', 'Hej! Jag är AI Arman. Fråga mig om produktval, en order eller paketspårning.');
      renderQuickReplies([
        { label: 'Hjälp mig välja schampo', value: 'Hjälp mig välja schampo' },
        { label: 'Var är mitt paket?', value: 'Var är mitt paket?' },
        { label: 'Hjälp med en köpt produkt', value: 'Jag behöver hjälp med en produkt jag köpt' }
      ]);
    }

    function renderQuickReplies(options) {
      if (!Array.isArray(options) || !options.length) return;
      const wrap = document.createElement('div');
      wrap.className = 'quick-replies';
      options.forEach((option) => {
        if (!option || typeof option.value !== 'string') return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'quick-reply';
        button.textContent = typeof option.label === 'string' ? option.label : option.value;
        button.addEventListener('click', () => sendMessage(option.value));
        wrap.appendChild(button);
      });
      if (wrap.childElementCount) messages.appendChild(wrap);
      scrollToBottom();
    }

    function isSafeHttpsUrl(value) {
      try {
        const url = new URL(value);
        return url.protocol === 'https:' && !url.username && !url.password;
      } catch (_) {
        return false;
      }
    }

    function isCompatibleChatResponse(result) {
      return !!result
        && typeof result === 'object'
        && result.contractVersion === CONTRACT_VERSION
        && typeof result.conversationId === 'string'
        && result.conversationId.length > 0
        && Array.isArray(result.blocks);
    }

    function renderCard(title, rows, link) {
      const card = document.createElement('section');
      card.className = 'card';
      const heading = document.createElement('div');
      heading.className = 'card-title';
      heading.textContent = title;
      card.appendChild(heading);
      rows.filter(Boolean).forEach((text) => {
        const row = document.createElement('div');
        row.className = 'card-meta';
        row.textContent = text;
        card.appendChild(row);
      });
      if (link && typeof link.href === 'string' && isSafeHttpsUrl(link.href)) {
        const anchor = document.createElement('a');
        anchor.href = link.href;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.textContent = link.label || 'Öppna';
        card.appendChild(anchor);
      }
      messages.appendChild(card);
      scrollToBottom();
    }

    function renderBlock(block) {
      if (!block || typeof block !== 'object') return;
      switch (block.type) {
        case 'message':
        case 'question':
          if (typeof block.text === 'string') appendText('bubble assistant', block.text);
          return;
        case 'quick_replies':
          renderQuickReplies(block.options);
          return;
        case 'order_status_card':
          renderCard('Order ' + safe(block.orderNumber), [
            safe(block.statusLabel || block.status),
            block.updatedAt ? 'Uppdaterad: ' + safe(block.updatedAt) : ''
          ]);
          return;
        case 'tracking_card':
          renderCard('Spårning · order ' + safe(block.orderNumber), [
            safe(block.trackingLabel || block.trackingStatus),
            block.carrier ? 'Transportör: ' + safe(block.carrier) : '',
            block.readAt ? 'Avläst: ' + safe(block.readAt) : ''
          ], block.trackingUrl ? { href: block.trackingUrl, label: 'Spåra paket' } : null);
          return;
        case 'product_cards':
          if (Array.isArray(block.cards)) block.cards.forEach(renderProductCard);
          return;
        case 'purchased_product_card':
          renderCard(
            safe(block.title),
            ['Order ' + safe(block.orderNumber)],
            block.productUrl ? { href: block.productUrl, label: 'Visa produkt' } : null
          );
          return;
        case 'safety_notice':
        case 'error_notice':
          if (typeof block.text === 'string') appendText('notice', block.text);
          return;
        case 'support_handoff':
          appendText('notice', block.status === 'available'
            ? 'Kundservice kan ta över med sammanhanget bevarat.'
            : 'Överlämning till kundservice är inte aktiverad i denna beta.');
          return;
      }
    }

    function renderProductCard(card) {
      if (!card || typeof card !== 'object') return;
      const price = typeof card.price === 'number'
        ? card.price.toLocaleString('sv-SE') + ' ' + safe(card.currency || 'SEK')
        : '';
      renderCard(safe(card.title), [
        price,
        card.stockStatus ? 'Lager: ' + safe(card.stockStatus) : '',
        Array.isArray(card.whyItFits) && card.whyItFits.length ? 'Passar eftersom: ' + card.whyItFits.map(safe).join(' · ') : ''
      ], card.productUrl ? { href: card.productUrl, label: 'Visa produkt' } : null);
    }

    function safe(value) { return String(value == null ? '' : value); }
    function scrollToBottom() { messages.scrollTop = messages.scrollHeight; }
    function nextClientMessageId() {
      messageSequence += 1;
      return 'widget-' + Date.now().toString(36) + '-' + messageSequence.toString(36);
    }

    async function sendMessage(text) {
      const trimmed = String(text || '').trim();
      if (!trimmed || busy) return;
      appendText('bubble user', trimmed);
      input.value = '';
      busy = true;
      send.disabled = true;
      status.textContent = 'AI Arman tänker…';

      const body = {
        contractVersion: CONTRACT_VERSION,
        clientMessageId: nextClientMessageId(),
        message: { text: trimmed },
        context: {
          locale: 'sv-SE',
          channel: 'internal_preview',
          page: { url: location.href }
        }
      };
      if (conversationId) body.conversationId = conversationId;

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json', 'accept': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!response.ok) throw new Error('chat_request_failed_' + response.status);
        const result = await response.json();
        if (!isCompatibleChatResponse(result)) throw new Error('chat_contract_mismatch');
        conversationId = result.conversationId;
        if (result.blocks.length) {
          result.blocks.forEach(renderBlock);
        } else {
          appendText('notice', 'Jag fick inget visningsbart svar. Försök igen.');
        }
      } catch (_) {
        appendText('notice', 'Chatten kunde inte nå backend just nu. Ingen osäker information visas.');
      } finally {
        busy = false;
        send.disabled = false;
        status.textContent = '';
        input.focus();
      }
    }

    launcher.addEventListener('click', () => setOpen(!panel.classList.contains('open')));
    close.addEventListener('click', () => setOpen(false));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      sendMessage(input.value);
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
      }
    });
  })();
  </script>
</body>
</html>`;
  }
}
