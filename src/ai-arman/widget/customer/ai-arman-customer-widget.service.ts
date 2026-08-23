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
  let pendingPrompt = null;
  let busy = false;
  let body = null;
  let composer = null;
  let input = null;
  let send = null;
  let panel = null;
  let launcher = null;
  let statusLabel = null;
  let typingNode = null;
  let categoriesSection = null;

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
      ':host{font-family:inherit;color:inherit}',
      '*{box-sizing:border-box}',
      '.shell{--hq-ink:#111111;--hq-muted:#666;--hq-faint:#8b8b8b;--hq-line:#e4e4e4;--hq-soft:#f6f6f6;--hq-warm:#f8f4f1;--hq-white:#fff;--hq-success:#2f9b5f;font-family:inherit,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:var(--hq-ink)}',
      '.launcher{position:fixed;right:18px;bottom:18px;z-index:2147483000;width:66px;height:66px;padding:4px;border:1px solid rgba(17,17,17,.12);border-radius:999px;background:#fff;box-shadow:0 12px 34px rgba(0,0,0,.18);cursor:pointer;transition:transform .18s ease,box-shadow .18s ease}',
      '.launcher:hover{transform:translateY(-1px);box-shadow:0 16px 40px rgba(0,0,0,.22)}',
      '.launcher:focus-visible,.close:focus-visible,.send:focus-visible,.topic:focus-visible,.identify-button:focus-visible,.field:focus-visible,.composer-input:focus-visible,.action-card:focus-visible,.category-card:focus-visible,.back:focus-visible,.human-link:focus-visible{outline:3px solid rgba(17,17,17,.22);outline-offset:2px}',
      '.launcher-avatar,.avatar{position:relative;display:grid;place-items:center;overflow:hidden;flex:none;border-radius:999px;background:var(--hq-soft);color:var(--hq-ink);font-weight:800}',
      '.launcher-avatar{width:56px;height:56px}.avatar{width:54px;height:54px}.launcher-avatar img,.avatar img{width:100%;height:100%;object-fit:cover;display:block}',
      '.launcher-dot{position:absolute;right:3px;bottom:3px;width:13px;height:13px;border:2px solid #fff;border-radius:50%;background:var(--hq-success)}',
      '.panel{position:fixed;right:16px;bottom:96px;z-index:2147482999;width:min(500px,calc(100vw - 24px));height:min(760px,calc(100vh - 116px));height:min(760px,calc(100dvh - 116px));display:none;grid-template-rows:auto minmax(0,1fr) auto;background:var(--hq-white);border:1px solid var(--hq-line);border-radius:24px;box-shadow:0 28px 80px rgba(0,0,0,.18);overflow:hidden;color:var(--hq-ink)}',
      '.panel[data-open="true"]{display:grid;animation:aiArmanIn .18s ease-out}@keyframes aiArmanIn{from{opacity:0;transform:translateY(8px) scale(.988)}to{opacity:1;transform:none}}',
      '.head{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;padding:15px 16px;border-bottom:1px solid var(--hq-line);background:#fff}.head-copy{min-width:0}.head-name{font-size:17px;font-weight:750;line-height:1.15}.status-row{display:flex;align-items:center;gap:6px;margin-top:4px}.status-pill{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--hq-line);border-radius:999px;padding:3px 7px;color:#444;font-size:10.5px;font-weight:650;line-height:1.1}.status-dot{width:7px;height:7px;border-radius:50%;background:var(--hq-success)}.head-subtitle{margin-top:4px;color:var(--hq-muted);font-size:11.5px;line-height:1.25}.close{width:38px;height:38px;border:0;border-radius:999px;background:transparent;color:var(--hq-ink);font:400 25px/1 inherit;cursor:pointer}.close:hover{background:var(--hq-soft)}',
      '.body{min-height:0;overflow:auto;padding:18px 16px 20px;display:flex;flex-direction:column;gap:16px;overscroll-behavior:contain;scrollbar-width:thin}.body:focus{outline:none}',
      '.intro{display:grid;gap:8px}.intro h2{margin:0;font:650 22px/1.18 inherit;letter-spacing:-.02em}.intro p{margin:0;color:var(--hq-muted);font-size:13px;line-height:1.5}',
      '.action-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.action-card{min-height:108px;border:1px solid var(--hq-line);border-radius:17px;background:#fff;padding:13px;text-align:left;cursor:pointer;color:var(--hq-ink);font-family:inherit;transition:border-color .16s ease,background .16s ease,transform .16s ease}.action-card:hover{border-color:#bdbdbd;background:#fcfcfc;transform:translateY(-1px)}.action-card[data-action="ask"]{background:var(--hq-warm)}.action-label{display:block;font-size:13.5px;font-weight:750;line-height:1.2}.action-copy{display:block;margin-top:7px;color:var(--hq-muted);font-size:11.5px;line-height:1.42}',
      '.section-rule{height:1px;background:var(--hq-line);margin:2px 0}.category-section{display:grid;gap:9px;scroll-margin-top:10px}.category-heading{display:grid;gap:3px}.category-heading h3{margin:0;font:650 17px/1.2 inherit}.category-heading p{margin:0;color:var(--hq-muted);font-size:11.5px}.category-row{display:grid;grid-auto-flow:column;grid-auto-columns:112px;gap:8px;overflow-x:auto;padding-bottom:4px;scroll-snap-type:x proximity;scrollbar-width:thin}.category-card{scroll-snap-align:start;min-height:96px;border:1px solid var(--hq-line);border-radius:15px;background:#fff;padding:12px 10px;text-decoration:none;color:var(--hq-ink);display:flex;flex-direction:column;justify-content:space-between;gap:12px}.category-card:hover{background:var(--hq-soft)}.category-mark{font-size:10px;font-weight:800;letter-spacing:.08em;color:var(--hq-faint)}.category-label{font-size:13px;font-weight:700}',
      '.identify-view{display:grid;gap:14px}.back{justify-self:start;border:0;background:transparent;padding:0;color:var(--hq-muted);font:650 12px/1.2 inherit;cursor:pointer}.identify-card{display:grid;gap:10px;padding:16px;border:1px solid var(--hq-line);border-radius:18px;background:var(--hq-soft)}.identify-card h3{margin:0;font-size:15px}.identify-card p{margin:0;color:var(--hq-muted);font-size:12px;line-height:1.45}.identify-form{display:grid;gap:8px}.field{width:100%;height:44px;border:1px solid #d2d2d2;border-radius:12px;background:#fff;color:var(--hq-ink);padding:0 12px;font:500 14px/1 inherit}.field::placeholder{color:#9a9a9a}.identify-button{height:44px;border:0;border-radius:12px;background:var(--hq-ink);color:#fff;font:700 13px/1 inherit;cursor:pointer}.identify-button:disabled{opacity:.46;cursor:default}',
      '.bubble-row{display:flex;align-items:flex-end;gap:8px}.bubble-row.user{justify-content:flex-end}.mini-avatar{width:32px;height:32px}.bubble{max-width:82%;padding:11px 12px;border:1px solid var(--hq-line);border-radius:16px 16px 16px 5px;background:#fff;font-size:13px;line-height:1.48;white-space:pre-wrap;overflow-wrap:anywhere}.bubble.user{border:0;border-radius:16px 16px 5px 16px;background:var(--hq-warm);color:var(--hq-ink)}.notice{padding:10px 12px;border:1px solid #e7d9cf;border-radius:13px;background:#fff8f2;color:#6d5546;font-size:12px;line-height:1.45}',
      '.topics{display:flex;flex-wrap:wrap;gap:7px}.topic{border:1px solid var(--hq-line);border-radius:999px;background:#fff;padding:8px 10px;color:#333;font:650 11.5px/1.2 inherit;cursor:pointer;text-align:left}.topic:hover{background:var(--hq-soft)}.topic:disabled{opacity:.45;cursor:default}',
      '.support-row{display:flex;justify-content:flex-start}.human-link{display:inline-flex;align-items:center;border:1px solid var(--hq-line);border-radius:999px;padding:8px 11px;color:#333;text-decoration:none;font-size:11.5px;font-weight:650;background:#fff}.human-link:hover{background:var(--hq-soft)}',
      '.typing{display:flex;align-items:center;gap:4px;width:max-content;padding:11px 13px;border:1px solid var(--hq-line);border-radius:16px 16px 16px 5px;background:#fff}.typing i{width:5px;height:5px;border-radius:50%;background:#888;animation:aiArmanDot 1s infinite ease-in-out}.typing i:nth-child(2){animation-delay:.14s}.typing i:nth-child(3){animation-delay:.28s}@keyframes aiArmanDot{0%,60%,100%{opacity:.35;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}',
      '.composer{display:flex;align-items:flex-end;gap:8px;padding:11px 12px calc(11px + env(safe-area-inset-bottom));border-top:1px solid var(--hq-line);background:#fff}.composer[hidden]{display:none}.composer-input{min-width:0;flex:1;max-height:96px;min-height:44px;resize:none;border:1px solid #d4d4d4;border-radius:999px;background:#fff;padding:11px 15px;font:500 14px/1.4 inherit;color:var(--hq-ink);overflow:auto}.composer-input::placeholder{color:#929292}.send{width:44px;height:44px;flex:none;border:0;border-radius:999px;background:var(--hq-ink);color:#fff;font:800 18px/1 inherit;cursor:pointer}.send:disabled,.composer-input:disabled{opacity:.45}',
      '.privacy{color:#888;font-size:10.5px;line-height:1.4;text-align:center;padding:0 8px}',
      '@media(max-width:640px){.launcher{right:12px;bottom:calc(12px + env(safe-area-inset-bottom));width:60px;height:60px}.launcher-avatar{width:50px;height:50px}.panel{left:6px;right:6px;bottom:calc(6px + env(safe-area-inset-bottom));width:auto;height:calc(100vh - 12px - env(safe-area-inset-bottom));height:calc(100dvh - 12px - env(safe-area-inset-bottom));max-height:none;border-radius:22px}.body{padding:16px 13px 18px}.action-grid{gap:8px}.action-card{min-height:102px;padding:12px}.category-row{grid-auto-columns:104px}.head{padding-left:13px}}',
      '@media(prefers-reduced-motion:reduce){.panel[data-open="true"],.typing i,.launcher,.action-card{animation:none;transition:none}}'
    ].join('');

    const shell = el('div', 'shell');
    launcher = el('button', 'launcher');
    launcher.type = 'button';
    launcher.setAttribute('aria-label', presentation.launcherLabel);
    launcher.setAttribute('aria-expanded', 'false');
    const launcherAvatar = makeAvatar('launcher-avatar');
    launcher.appendChild(launcherAvatar);
    launcher.appendChild(el('span', 'launcher-dot'));

    panel = el('section', 'panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-label', presentation.assistantName);
    panel.setAttribute('data-open', 'false');

    const head = el('header', 'head');
    head.appendChild(makeAvatar('avatar'));
    const headCopy = el('div', 'head-copy');
    headCopy.appendChild(el('div', 'head-name', presentation.assistantName));
    const statusRow = el('div', 'status-row');
    const statusPill = el('span', 'status-pill');
    statusPill.appendChild(el('span', 'status-dot'));
    statusLabel = el('span', '', presentation.statusIdle);
    statusPill.appendChild(statusLabel);
    statusRow.appendChild(statusPill);
    headCopy.append(statusRow, el('div', 'head-subtitle', presentation.assistantSubtitle));
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
    send = el('button', 'send', '→');
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
      const focusTarget = body.querySelector('input,button,a') || input || body;
      if (focusTarget && typeof focusTarget.focus === 'function') focusTarget.focus();
    }, 0);
  }

  function closePanel() {
    panel.setAttribute('data-open', 'false');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.focus();
  }

  function setStatus(verified) {
    if (statusLabel) statusLabel.textContent = verified ? presentation.statusVerified : presentation.statusIdle;
  }

  function renderStart(message) {
    body.textContent = '';
    composer.hidden = true;
    const token = sessionStorage.getItem(sessionKey) || '';
    setStatus(Boolean(token));
    if (token) return renderChatStart();
    if (message) appendNotice(message);
    renderLanding();
  }

  function renderLanding() {
    const intro = el('section', 'intro');
    intro.append(el('h2', '', presentation.welcomeTitle), el('p', '', presentation.welcomeText));
    body.appendChild(intro);

    const grid = el('div', 'action-grid');
    presentation.actionCards.forEach((action) => {
      const button = el('button', 'action-card');
      button.type = 'button';
      button.setAttribute('data-action', action.id);
      const label = el('span', 'action-label', action.label);
      const copy = el('span', 'action-copy', action.description);
      button.append(label, copy);
      button.addEventListener('click', () => onAction(action));
      grid.appendChild(button);
    });
    body.appendChild(grid);

    body.appendChild(el('div', 'section-rule'));
    categoriesSection = el('section', 'category-section');
    const heading = el('div', 'category-heading');
    heading.append(el('h3', '', presentation.categoryTitle), el('p', '', presentation.categoryText));
    const row = el('div', 'category-row');
    presentation.categories.forEach((category) => {
      const link = el('a', 'category-card');
      link.href = category.href;
      link.setAttribute('aria-label', 'Öppna ' + category.label);
      link.append(el('span', 'category-mark', category.mark), el('span', 'category-label', category.label));
      row.appendChild(link);
    });
    categoriesSection.append(heading, row);
    body.appendChild(categoriesSection);
    body.appendChild(el('div', 'privacy', presentation.privacyText));
  }

  function onAction(action) {
    if (action.id === 'assortment') {
      if (categoriesSection && typeof categoriesSection.scrollIntoView === 'function') {
        categoriesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    const token = sessionStorage.getItem(sessionKey) || '';
    const prompt = String(action.prompt || '').trim();
    if (token) {
      renderChatStart();
      if (prompt) {
        input.value = prompt;
        resizeComposer();
        input.focus();
      }
      return;
    }
    pendingPrompt = prompt || null;
    renderIdentityView();
  }

  function renderIdentityView(message) {
    body.textContent = '';
    composer.hidden = true;
    if (message) appendNotice(message);
    const view = el('section', 'identify-view');
    const back = el('button', 'back', '← Tillbaka');
    back.type = 'button';
    back.addEventListener('click', renderStart);
    const card = el('section', 'identify-card');
    card.append(el('h3', '', presentation.identityTitle), el('p', '', presentation.identityText));
    view.append(back, card, el('div', 'privacy', presentation.privacyText));
    body.appendChild(view);
    renderEmailStep(card);
    window.setTimeout(() => {
      const email = card.querySelector('input[type="email"]');
      if (email) email.focus();
    }, 0);
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
        setStatus(true);
        renderChatStart();
        if (pendingPrompt) {
          input.value = pendingPrompt;
          pendingPrompt = null;
          resizeComposer();
        }
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
    setStatus(true);
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
    const support = el('div', 'support-row');
    const human = el('a', 'human-link', presentation.humanSupportLabel);
    human.href = presentation.humanSupportUrl;
    support.appendChild(human);
    body.append(support, el('div', 'privacy', presentation.privacyText));
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
        setStatus(false);
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
    const row = el('div', role === 'user' ? 'bubble-row user' : 'bubble-row');
    if (role !== 'user') row.appendChild(makeAvatar('avatar mini-avatar'));
    row.appendChild(el('div', role === 'user' ? 'bubble user' : 'bubble', text));
    body.appendChild(row);
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
