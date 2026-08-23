import { Injectable } from '@nestjs/common';
import {
  AI_ARMAN_CUSTOMER_WIDGET_DEFAULT_PRESENTATION,
  type AiArmanCustomerWidgetPresentationV1,
} from './ai-arman-customer-widget.presentation';

@Injectable()
export class AiArmanCustomerWidgetService {
  renderScript(
    presentation: AiArmanCustomerWidgetPresentationV1 =
      AI_ARMAN_CUSTOMER_WIDGET_DEFAULT_PRESENTATION,
  ): string {
    const serializedPresentation = JSON.stringify(presentation)
      .replace(/</g, '\\u003c')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');

    return `(() => {
  'use strict';
  if (window.__AI_ARMAN_CUSTOMER_WIDGET__) return;
  window.__AI_ARMAN_CUSTOMER_WIDGET__ = true;

  const presentation = ${serializedPresentation};
  const sourceScript = document.currentScript;
  const sourceData = sourceScript && sourceScript.dataset ? sourceScript.dataset : {};
  const apiBase = String(sourceData.apiBase || '/ai-arman/customer').replace(/\\/+$/, '');
  const avatarUrl = String(sourceData.avatarUrl || presentation.avatarUrl || '').trim();
  const sessionKey = 'aiArmanCustomerSessionV1';
  let challengeId = null;
  let conversationId = null;
  let busy = false;
  let body = null;
  let composer = null;
  let input = null;
  let send = null;
  let panel = null;
  let launcher = null;
  let typingNode = null;

  if (document.body) mount();
  else window.addEventListener('DOMContentLoaded', mount, { once: true });

  function mount() {
    if (document.querySelector('[data-ai-arman-customer-host]')) return;

    const host = document.createElement('div');
    host.setAttribute('data-ai-arman-customer-host', presentation.contractVersion);
    const root = typeof host.attachShadow === 'function'
      ? host.attachShadow({ mode: 'open' })
      : host;

    const style = document.createElement('style');
    style.textContent = [
      ':host{all:initial}',
      '*{box-sizing:border-box}',
      '.shell{--ink:#171513;--muted:#746d68;--line:#e9e2dd;--soft:#f7f4f1;--warm:#efe5de;--white:#fff;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink)}',
      '.launcher{position:fixed;right:18px;bottom:18px;z-index:2147483000;display:flex;align-items:center;gap:10px;min-height:58px;border:1px solid rgba(255,255,255,.55);border-radius:999px;background:#171513;color:#fff;padding:7px 16px 7px 7px;box-shadow:0 16px 44px rgba(23,21,19,.24);cursor:pointer;font:700 14px/1.1 inherit;transition:transform .18s ease,box-shadow .18s ease}',
      '.launcher:hover{transform:translateY(-1px);box-shadow:0 20px 50px rgba(23,21,19,.3)}.launcher:focus-visible,.close:focus-visible,.send:focus-visible,.topic:focus-visible,.identify-button:focus-visible,.field:focus-visible,.composer-input:focus-visible{outline:3px solid rgba(23,21,19,.22);outline-offset:2px}',
      '.launcher-avatar,.avatar{position:relative;display:grid;place-items:center;overflow:hidden;flex:none;border-radius:999px;background:linear-gradient(145deg,#d8c5b9,#9c7c6d);color:#fff;font-weight:800;letter-spacing:-.03em}',
      '.launcher-avatar{width:44px;height:44px;font-size:13px}.avatar{width:46px;height:46px;font-size:13px}.avatar.hero-avatar{width:58px;height:58px;font-size:15px}',
      '.launcher-avatar img,.avatar img{width:100%;height:100%;object-fit:cover;display:block}',
      '.launcher-copy{display:flex;flex-direction:column;align-items:flex-start;gap:2px;white-space:nowrap}.launcher-copy small{font-size:10px;font-weight:600;color:#d8d0cb}.launcher-copy span{font-size:13px}',
      '.panel{position:fixed;right:16px;bottom:88px;z-index:2147482999;width:min(420px,calc(100vw - 24px));height:min(680px,calc(100vh - 112px));height:min(680px,calc(100dvh - 112px));display:none;grid-template-rows:auto minmax(0,1fr) auto;background:var(--white);border:1px solid var(--line);border-radius:26px;box-shadow:0 28px 90px rgba(23,21,19,.22);overflow:hidden;color:var(--ink)}',
      '.panel[data-open="true"]{display:grid;animation:aiArmanIn .18s ease-out}@keyframes aiArmanIn{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:none}}',
      '.head{display:flex;align-items:center;gap:11px;padding:15px 15px 14px 16px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.96)}.head-copy{min-width:0;flex:1}.head-name{display:flex;align-items:center;gap:7px;font-size:15px;font-weight:800;line-height:1.2}.online{width:7px;height:7px;border-radius:50%;background:#3c9d69;box-shadow:0 0 0 3px #e8f5ed}.head-subtitle{margin-top:2px;color:var(--muted);font-size:11.5px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.close{width:38px;height:38px;border:0;border-radius:12px;background:transparent;color:var(--ink);font:400 25px/1 inherit;cursor:pointer}.close:hover{background:var(--soft)}',
      '.body{min-height:0;overflow:auto;padding:18px 16px 20px;display:flex;flex-direction:column;gap:12px;overscroll-behavior:contain;scrollbar-width:thin}.body:focus{outline:none}',
      '.hero{padding:18px;border:1px solid var(--line);border-radius:20px;background:linear-gradient(145deg,#fff 10%,#faf6f3 100%)}.hero-top{display:flex;align-items:center;gap:12px;margin-bottom:12px}.hero h2{margin:0;font-size:19px;line-height:1.15;letter-spacing:-.025em}.hero p{margin:0;color:var(--muted);font-size:13px;line-height:1.52}',
      '.capabilities{display:flex;flex-wrap:wrap;gap:7px;margin-top:14px}.capability{border:1px solid var(--line);border-radius:999px;background:#fff;padding:7px 9px;color:#5e5752;font-size:11px;font-weight:650}',
      '.identify-card{display:grid;gap:10px;padding:15px;border-radius:18px;background:var(--soft)}.identify-card h3{margin:0;font-size:14px}.identify-card p{margin:0;color:var(--muted);font-size:12px;line-height:1.45}.identify-form{display:grid;gap:8px}.field{width:100%;height:44px;border:1px solid #d8cfc9;border-radius:13px;background:#fff;color:var(--ink);padding:0 12px;font:500 14px/1 inherit}.field::placeholder{color:#a29a94}.identify-button{height:44px;border:0;border-radius:13px;background:#171513;color:#fff;font:750 13px/1 inherit;cursor:pointer}.identify-button:disabled{opacity:.46;cursor:default}',
      '.bubble{max-width:86%;padding:10px 12px;border-radius:16px 16px 16px 5px;background:var(--soft);font-size:13px;line-height:1.48;white-space:pre-wrap;overflow-wrap:anywhere}.bubble.user{align-self:flex-end;border-radius:16px 16px 5px 16px;background:#171513;color:#fff}.notice{padding:10px 12px;border:1px solid #ead9c9;border-radius:14px;background:#fff8f1;color:#765e4d;font-size:12px;line-height:1.45}',
      '.topics{display:flex;flex-wrap:wrap;gap:7px;margin-top:1px}.topic{border:1px solid var(--line);border-radius:999px;background:#fff;padding:8px 10px;color:#4c4541;font:650 11.5px/1.2 inherit;cursor:pointer;text-align:left}.topic:hover{background:var(--soft)}.topic:disabled{opacity:.45;cursor:default}',
      '.typing{display:flex;align-items:center;gap:4px;width:max-content;padding:11px 13px;border-radius:16px 16px 16px 5px;background:var(--soft)}.typing i{width:5px;height:5px;border-radius:50%;background:#8d847e;animation:aiArmanDot 1s infinite ease-in-out}.typing i:nth-child(2){animation-delay:.14s}.typing i:nth-child(3){animation-delay:.28s}@keyframes aiArmanDot{0%,60%,100%{opacity:.35;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}',
      '.composer{display:flex;align-items:flex-end;gap:8px;padding:11px 12px calc(11px + env(safe-area-inset-bottom));border-top:1px solid var(--line);background:#fff}.composer[hidden]{display:none}.composer-input{min-width:0;flex:1;max-height:96px;min-height:44px;resize:none;border:1px solid #d9d1cc;border-radius:15px;background:#fff;padding:11px 12px;font:500 14px/1.4 inherit;color:var(--ink);overflow:auto}.composer-input::placeholder{color:#9b938e}.send{width:44px;height:44px;flex:none;border:0;border-radius:14px;background:#171513;color:#fff;font:800 18px/1 inherit;cursor:pointer}.send:disabled,.composer-input:disabled{opacity:.45}',
      '.privacy{margin-top:2px;color:#948b85;font-size:10.5px;line-height:1.4;text-align:center;padding:0 8px}',
      '@media(max-width:640px){.launcher{right:12px;bottom:calc(12px + env(safe-area-inset-bottom));padding-right:9px}.launcher-copy{display:none}.panel{left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));width:auto;height:calc(100vh - 16px - env(safe-area-inset-bottom));height:calc(100dvh - 16px - env(safe-area-inset-bottom));max-height:none;border-radius:24px}.body{padding:16px 14px 18px}.head{padding-left:14px}}',
      '@media(prefers-reduced-motion:reduce){.panel[data-open="true"],.typing i,.launcher{animation:none;transition:none}}'
    ].join('');

    const shell = el('div', 'shell');
    launcher = el('button', 'launcher');
    launcher.type = 'button';
    launcher.setAttribute('aria-label', presentation.launcherLabel);
    launcher.setAttribute('aria-expanded', 'false');
    launcher.appendChild(makeAvatar('launcher-avatar'));
    const launcherCopy = el('span', 'launcher-copy');
    launcherCopy.append(el('small', '', 'HARMONIQ'), el('span', '', presentation.launcherLabel));
    launcher.appendChild(launcherCopy);

    panel = el('section', 'panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-label', presentation.assistantName);
    panel.setAttribute('data-open', 'false');

    const head = el('header', 'head');
    head.appendChild(makeAvatar('avatar'));
    const headCopy = el('div', 'head-copy');
    const headName = el('div', 'head-name');
    headName.append(el('span', '', presentation.assistantName), el('span', 'online'));
    headCopy.append(headName, el('div', 'head-subtitle', presentation.assistantSubtitle));
    const close = el('button', 'close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Stäng AI Arman');
    head.append(headCopy, close);

    body = el('div', 'body');
    body.setAttribute('role', 'log');
    body.setAttribute('aria-live', 'polite');
    body.setAttribute('aria-relevant', 'additions text');
    body.tabIndex = -1;

    composer = el('form', 'composer');
    composer.hidden = true;
    input = el('textarea', 'composer-input');
    input.rows = 1;
    input.maxLength = 2000;
    input.placeholder = presentation.composerPlaceholder;
    input.setAttribute('aria-label', presentation.composerPlaceholder);
    send = el('button', 'send', '↑');
    send.type = 'submit';
    send.setAttribute('aria-label', 'Skicka meddelande');
    composer.append(input, send);

    panel.append(head, body, composer);
    shell.append(launcher, panel);
    root.append(style, shell);
    document.body.appendChild(host);

    launcher.addEventListener('click', openPanel);
    close.addEventListener('click', closePanel);
    composer.addEventListener('submit', onSubmit);
    input.addEventListener('input', resizeComposer);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        if (typeof composer.requestSubmit === 'function') composer.requestSubmit();
        else send.click();
      }
    });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && panel.getAttribute('data-open') === 'true') closePanel();
    });
  }

  function openPanel() {
    panel.setAttribute('data-open', 'true');
    launcher.setAttribute('aria-expanded', 'true');
    if (!body.childElementCount) renderStart();
    window.setTimeout(() => {
      const focusTarget = body.querySelector('input,button') || input || body;
      if (focusTarget && typeof focusTarget.focus === 'function') focusTarget.focus();
    }, 0);
  }

  function closePanel() {
    panel.setAttribute('data-open', 'false');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.focus();
  }

  function renderStart(message) {
    body.textContent = '';
    composer.hidden = true;
    if (message) appendNotice(message);
    const token = sessionStorage.getItem(sessionKey) || '';
    if (token) return renderChatStart();

    const hero = el('section', 'hero');
    const heroTop = el('div', 'hero-top');
    heroTop.append(makeAvatar('avatar hero-avatar'), el('h2', '', presentation.welcomeTitle));
    hero.append(heroTop, el('p', '', presentation.welcomeText));
    const capabilities = el('div', 'capabilities');
    ['Produkter', 'Hud & hår', 'Order', 'Retur & reklamation'].forEach((label) => {
      capabilities.appendChild(el('span', 'capability', label));
    });
    hero.appendChild(capabilities);
    body.appendChild(hero);

    const card = el('section', 'identify-card');
    card.append(el('h3', '', presentation.identityTitle), el('p', '', presentation.identityText));
    body.appendChild(card);
    renderEmailStep(card);
    body.appendChild(el('div', 'privacy', presentation.privacyText));
  }

  function renderEmailStep(card) {
    const form = el('form', 'identify-form');
    const email = el('input', 'field');
    email.type = 'email';
    email.autocomplete = 'email';
    email.inputMode = 'email';
    email.placeholder = 'Din e-postadress';
    email.setAttribute('aria-label', 'Din e-postadress');
    const button = el('button', 'identify-button', 'Skicka engångskod');
    button.type = 'submit';
    form.append(email, button);
    card.appendChild(form);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (busy) return;
      busy = true;
      button.disabled = true;
      try {
        const result = await postJson(apiBase + '/identity/start', { email: email.value });
        if (!result || !result.ok || typeof result.challengeId !== 'string') throw new Error('identity_start_failed');
        challengeId = result.challengeId;
        form.remove();
        card.appendChild(el('p', '', 'Vi har skickat en sexsiffrig kod om adressen kan verifieras.'));
        renderCodeStep(card);
      } catch (_) {
        appendNotice('Identifieringen är inte tillgänglig just nu. Försök igen senare.');
      } finally {
        busy = false;
        button.disabled = false;
      }
    });
  }

  function renderCodeStep(card) {
    const form = el('form', 'identify-form');
    const code = el('input', 'field');
    code.inputMode = 'numeric';
    code.autocomplete = 'one-time-code';
    code.maxLength = 6;
    code.pattern = '[0-9]{6}';
    code.placeholder = 'Sexsiffrig kod';
    code.setAttribute('aria-label', 'Sexsiffrig kod');
    const button = el('button', 'identify-button', 'Verifiera och öppna chatten');
    button.type = 'submit';
    form.append(code, button);
    card.appendChild(form);
    window.setTimeout(() => code.focus(), 0);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (busy || !challengeId) return;
      busy = true;
      button.disabled = true;
      try {
        const result = await postJson(apiBase + '/identity/verify', { challengeId, code: code.value });
        if (!result || !result.ok || typeof result.sessionToken !== 'string') throw new Error('identity_verify_failed');
        sessionStorage.setItem(sessionKey, result.sessionToken);
        challengeId = null;
        renderChatStart();
        input.focus();
      } catch (_) {
        appendNotice('Koden kunde inte verifieras. Kontrollera koden eller börja om.');
      } finally {
        busy = false;
        button.disabled = false;
      }
    });
  }

  function renderChatStart() {
    body.textContent = '';
    composer.hidden = false;
    appendBubble('assistant', presentation.verifiedWelcome);
    const topics = el('div', 'topics');
    presentation.quickPrompts.forEach((prompt) => {
      const button = el('button', 'topic', prompt);
      button.type = 'button';
      button.addEventListener('click', () => {
        const token = sessionStorage.getItem(sessionKey) || '';
        if (!token || busy) return renderStart();
        void submitText(token, prompt);
      });
      topics.appendChild(button);
    });
    body.appendChild(topics);
    body.appendChild(el('div', 'privacy', presentation.privacyText));
    scrollBody();
  }

  function onSubmit(event) {
    event.preventDefault();
    const token = sessionStorage.getItem(sessionKey) || '';
    if (!token) return renderStart();
    const text = String(input.value || '').trim();
    if (!text || busy) return;
    input.value = '';
    resizeComposer();
    void submitText(token, text);
  }

  async function submitText(token, text) {
    appendBubble('user', text);
    await sendChat(token, text);
  }

  async function sendChat(token, text) {
    setBusy(true);
    try {
      const request = {
        contractVersion: 'ai-arman-chat-v1',
        clientMessageId: 'customer-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
        message: { text: text },
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
        conversationId = null;
        throw new Error('session_expired');
      }
      if (!response.ok) throw new Error('chat_failed');
      const result = await response.json();
      if (typeof result.conversationId === 'string') conversationId = result.conversationId;
      const blocks = Array.isArray(result.blocks) ? result.blocks : [];
      blocks.forEach((block) => {
        if (block && (block.type === 'message' || block.type === 'question') && typeof block.text === 'string') appendBubble('assistant', block.text);
        if (block && (block.type === 'safety_notice' || block.type === 'error_notice') && typeof block.text === 'string') appendNotice(block.text);
      });
      if (!blocks.length) appendNotice('Jag fick inget visningsbart svar. Försök gärna igen.');
    } catch (error) {
      if (error && error.message === 'session_expired') {
        renderStart('Din verifiering har gått ut. Verifiera dig igen för att fortsätta.');
      } else {
        appendNotice('Chatten kunde inte nås just nu. Försök igen om en liten stund.');
      }
    } finally {
      setBusy(false);
    }
  }

  function setBusy(value) {
    busy = value;
    if (send) send.disabled = value;
    if (input) input.disabled = value;
    const topics = body ? body.querySelectorAll('.topic') : [];
    topics.forEach((button) => { button.disabled = value; });
    if (value) showTyping();
    else hideTyping();
  }

  function showTyping() {
    hideTyping();
    typingNode = el('div', 'typing');
    typingNode.setAttribute('aria-label', presentation.assistantName + ' skriver');
    typingNode.append(el('i'), el('i'), el('i'));
    body.appendChild(typingNode);
    scrollBody();
  }

  function hideTyping() {
    if (typingNode && typingNode.parentNode) typingNode.remove();
    typingNode = null;
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

  function appendBubble(role, text) {
    const node = el('div', role === 'user' ? 'bubble user' : 'bubble', text);
    body.appendChild(node);
    scrollBody();
  }

  function appendNotice(text) {
    const node = el('div', 'notice', text);
    body.appendChild(node);
    scrollBody();
  }

  function makeAvatar(className) {
    const node = el('span', className, avatarUrl ? undefined : 'AI');
    if (avatarUrl) {
      const image = document.createElement('img');
      image.src = avatarUrl;
      image.alt = '';
      image.loading = 'lazy';
      node.appendChild(image);
    }
    return node;
  }

  function resizeComposer() {
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 96) + 'px';
  }

  function scrollBody() {
    if (!body) return;
    window.requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });
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
