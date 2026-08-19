import { Injectable } from '@nestjs/common';

@Injectable()
export class AiArmanCustomerWidgetService {
  renderScript(): string {
    return `(() => {
  'use strict';
  if (window.__AI_ARMAN_CUSTOMER_WIDGET__) return;
  window.__AI_ARMAN_CUSTOMER_WIDGET__ = true;

  const apiBase = '/ai-arman/customer';
  const sessionKey = 'aiArmanCustomerSessionV1';
  let challengeId = null;
  let conversationId = null;
  let busy = false;

  const style = document.createElement('style');
  style.textContent = [
    '.ai-arman-launcher{position:fixed;right:18px;bottom:18px;z-index:2147483000;border:0;border-radius:999px;background:#111;color:#fff;padding:14px 18px;font:700 14px/1.2 Arial,sans-serif;box-shadow:0 14px 40px rgba(0,0,0,.22);cursor:pointer}',
    '.ai-arman-panel{position:fixed;right:16px;bottom:76px;z-index:2147482999;width:min(410px,calc(100vw - 24px));height:min(650px,calc(100dvh - 100px));display:none;grid-template-rows:auto 1fr auto;background:#fff;border:1px solid #e7e1dd;border-radius:22px;box-shadow:0 24px 80px rgba(0,0,0,.2);overflow:hidden;font:14px/1.45 Arial,sans-serif;color:#1d1b1a}',
    '.ai-arman-panel.open{display:grid}.ai-arman-head{display:flex;align-items:center;gap:10px;padding:15px 16px;border-bottom:1px solid #eee}.ai-arman-head strong{flex:1}.ai-arman-close{border:0;background:transparent;font-size:22px;cursor:pointer}.ai-arman-body{overflow:auto;padding:16px;display:flex;flex-direction:column;gap:11px}.ai-arman-msg{max-width:86%;padding:10px 12px;border-radius:16px;background:#f3f1ef}.ai-arman-msg.user{align-self:flex-end;background:#111;color:#fff}.ai-arman-note{padding:10px 12px;border-radius:14px;background:#fff7e3;border:1px solid #ead8a9}.ai-arman-form{padding:12px;border-top:1px solid #eee;display:flex;gap:8px}.ai-arman-input{min-width:0;flex:1;border:1px solid #d8d1cc;border-radius:13px;padding:11px;font:inherit}.ai-arman-send{border:0;border-radius:13px;background:#111;color:#fff;padding:0 15px;font-weight:700}.ai-arman-send:disabled{opacity:.45}.ai-arman-identify{display:grid;gap:9px}.ai-arman-identify button{height:42px;border:0;border-radius:12px;background:#111;color:#fff;font-weight:700;cursor:pointer}.ai-arman-identify input{height:42px;border:1px solid #d8d1cc;border-radius:12px;padding:0 11px;font:inherit}',
    '@media(max-width:520px){.ai-arman-panel{inset:0;width:100%;height:100dvh;border:0;border-radius:0}.ai-arman-launcher{right:14px;bottom:14px}}'
  ].join('');
  document.head.appendChild(style);

  const launcher = el('button', 'ai-arman-launcher', 'Fråga AI Arman');
  launcher.type = 'button';
  const panel = el('section', 'ai-arman-panel');
  const head = el('header', 'ai-arman-head');
  head.appendChild(el('strong', '', 'AI Arman'));
  head.appendChild(el('span', '', 'Verifierad kundchatt'));
  const close = el('button', 'ai-arman-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Stäng');
  head.appendChild(close);
  const body = el('div', 'ai-arman-body');
  const form = el('form', 'ai-arman-form');
  const input = el('input', 'ai-arman-input');
  input.type = 'text';
  input.maxLength = 2000;
  input.placeholder = 'Skriv din fråga…';
  const send = el('button', 'ai-arman-send', 'Skicka');
  send.type = 'submit';
  form.append(input, send);
  panel.append(head, body, form);
  document.body.append(launcher, panel);

  launcher.addEventListener('click', () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open') && !body.childElementCount) renderStart();
  });
  close.addEventListener('click', () => panel.classList.remove('open'));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const token = sessionStorage.getItem(sessionKey) || '';
    if (!token) return renderStart();
    const text = String(input.value || '').trim();
    if (!text || busy) return;
    append('ai-arman-msg user', text);
    input.value = '';
    await sendChat(token, text);
  });

  function renderStart() {
    body.textContent = '';
    const token = sessionStorage.getItem(sessionKey) || '';
    if (token) {
      append('ai-arman-msg', 'Hej! Du är identifierad. Vad vill du ha hjälp med?');
      return;
    }
    append('ai-arman-note', 'För att skydda kunduppgifter behöver du identifiera dig innan chatten öppnas.');
    renderEmailStep();
  }

  function renderEmailStep() {
    const wrap = el('div', 'ai-arman-identify');
    const email = el('input');
    email.type = 'email';
    email.autocomplete = 'email';
    email.placeholder = 'Din e-postadress';
    const button = el('button', '', 'Skicka engångskod');
    button.type = 'button';
    button.addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      button.disabled = true;
      try {
        const result = await postJson(apiBase + '/identity/start', { email: email.value });
        if (!result || !result.ok || typeof result.challengeId !== 'string') throw new Error('identity_start_failed');
        challengeId = result.challengeId;
        wrap.remove();
        append('ai-arman-msg', 'Vi har skickat en sexsiffrig kod om adressen kan verifieras.');
        renderCodeStep();
      } catch (_) {
        append('ai-arman-note', 'Identifieringen är inte tillgänglig just nu. Försök igen senare.');
      } finally {
        busy = false;
        button.disabled = false;
      }
    });
    wrap.append(email, button);
    body.appendChild(wrap);
  }

  function renderCodeStep() {
    const wrap = el('div', 'ai-arman-identify');
    const code = el('input');
    code.inputMode = 'numeric';
    code.autocomplete = 'one-time-code';
    code.maxLength = 6;
    code.placeholder = 'Sexsiffrig kod';
    const button = el('button', '', 'Verifiera och öppna chatten');
    button.type = 'button';
    button.addEventListener('click', async () => {
      if (busy || !challengeId) return;
      busy = true;
      button.disabled = true;
      try {
        const result = await postJson(apiBase + '/identity/verify', { challengeId, code: code.value });
        if (!result || !result.ok || typeof result.sessionToken !== 'string') throw new Error('identity_verify_failed');
        sessionStorage.setItem(sessionKey, result.sessionToken);
        challengeId = null;
        body.textContent = '';
        append('ai-arman-msg', 'Klart – du är identifierad. Vad vill du ha hjälp med?');
        input.focus();
      } catch (_) {
        append('ai-arman-note', 'Koden kunde inte verifieras. Kontrollera koden eller börja om.');
      } finally {
        busy = false;
        button.disabled = false;
      }
    });
    wrap.append(code, button);
    body.appendChild(wrap);
  }

  async function sendChat(token, text) {
    busy = true;
    send.disabled = true;
    try {
      const request = {
        contractVersion: 'ai-arman-chat-v1',
        clientMessageId: 'customer-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
        message: { text },
        context: { locale: 'sv-SE', channel: 'web_widget', page: { url: location.href } }
      };
      if (conversationId) request.conversationId = conversationId;
      const response = await fetch(apiBase + '/chat/messages', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + token },
        body: JSON.stringify(request)
      });
      if (response.status === 401) {
        sessionStorage.removeItem(sessionKey);
        throw new Error('session_expired');
      }
      if (!response.ok) throw new Error('chat_failed');
      const result = await response.json();
      if (typeof result.conversationId === 'string') conversationId = result.conversationId;
      const blocks = Array.isArray(result.blocks) ? result.blocks : [];
      blocks.forEach((block) => {
        if (block && (block.type === 'message' || block.type === 'question') && typeof block.text === 'string') append('ai-arman-msg', block.text);
        if (block && (block.type === 'safety_notice' || block.type === 'error_notice') && typeof block.text === 'string') append('ai-arman-note', block.text);
      });
      if (!blocks.length) append('ai-arman-note', 'Jag fick inget visningsbart svar.');
    } catch (error) {
      append('ai-arman-note', error && error.message === 'session_expired' ? 'Din verifiering har gått ut. Identifiera dig igen för att fortsätta.' : 'Chatten kunde inte nås just nu.');
    } finally {
      busy = false;
      send.disabled = false;
    }
  }

  async function postJson(url, payload) {
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('request_failed_' + response.status);
    return response.json();
  }

  function append(className, text) {
    const node = el('div', className, text);
    body.appendChild(node);
    body.scrollTop = body.scrollHeight;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }
})();`;
  }
}
