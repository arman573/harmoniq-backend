import { Injectable } from '@nestjs/common';
import {
  CustomerEmailOtpSender,
  type CustomerEmailOtpSendResult,
} from './ai-arman-customer-identity.providers';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const DEFAULT_TIMEOUT_MS = 5000;

@Injectable()
export class GmailCustomerEmailOtpSender extends CustomerEmailOtpSender {
  async send(input: {
    email: string;
    code: string;
    expiresAt: string;
  }): Promise<CustomerEmailOtpSendResult> {
    const config = readConfig();
    if (!config.enabled || !config.ready) {
      return { ok: false, error: 'delivery_unavailable' };
    }

    const email = normalizeEmail(input.email);
    if (!email || !/^\d{6}$/.test(input.code)) {
      return { ok: false, error: 'delivery_unavailable' };
    }

    try {
      const accessToken = await fetchAccessToken(config);
      if (!accessToken) return { ok: false, error: 'delivery_unavailable' };

      const raw = buildRawMessage({
        from: config.from,
        to: email,
        code: input.code,
        expiresAt: input.expiresAt,
      });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
      try {
        const response = await fetch(GMAIL_SEND_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ raw }),
          redirect: 'error',
          signal: controller.signal,
        });
        return response.ok
          ? { ok: true }
          : { ok: false, error: 'delivery_unavailable' };
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      return { ok: false, error: 'delivery_unavailable' };
    }
  }
}

function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const enabled =
    String(env.AI_ARMAN_CUSTOMER_OTP_EMAIL_ENABLED || '')
      .trim()
      .toLowerCase() === 'true';
  const clientId = String(env.GMAIL_CLIENT_ID || '').trim();
  const clientSecret = String(env.GMAIL_CLIENT_SECRET || '').trim();
  const refreshToken = String(env.GMAIL_REFRESH_TOKEN || '').trim();
  const from = normalizeEmail(
    env.AI_ARMAN_CUSTOMER_OTP_FROM_EMAIL ||
      env.GMAIL_OUTBOUND_EMAIL ||
      env.GMAIL_INBOUND_EMAIL ||
      '',
  );
  const configuredTimeout = Number(env.AI_ARMAN_CUSTOMER_OTP_EMAIL_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(configuredTimeout)
    ? Math.min(10_000, Math.max(1000, configuredTimeout))
    : DEFAULT_TIMEOUT_MS;
  return {
    enabled,
    clientId,
    clientSecret,
    refreshToken,
    from: from || '',
    timeoutMs,
    ready: Boolean(clientId && clientSecret && refreshToken && from),
  };
}

async function fetchAccessToken(config: ReturnType<typeof readConfig>): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: 'refresh_token',
    });
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { access_token?: unknown };
    const token =
      typeof payload.access_token === 'string' ? payload.access_token.trim() : '';
    return token || null;
  } finally {
    clearTimeout(timeout);
  }
}

function buildRawMessage(input: {
  from: string;
  to: string;
  code: string;
  expiresAt: string;
}): string {
  const expires = formatExpiry(input.expiresAt);
  const subject = encodeMimeHeader('Din kod till AI Arman');
  const text = [
    'Hej!',
    '',
    `Din engångskod till AI Arman är: ${input.code}`,
    expires ? `Koden gäller till ${expires}.` : 'Koden gäller en kort stund.',
    '',
    'Om du inte försökte öppna AI Arman kan du ignorera det här mailet.',
    '',
    'HARMONIQ',
  ].join('\r\n');
  const lines = [
    `From: HARMONIQ <${input.from}>`,
    `To: ${input.to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    text,
  ];
  return Buffer.from(lines.join('\r\n'), 'utf8').toString('base64url');
}

function formatExpiry(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Stockholm',
  }).format(date);
}

function encodeMimeHeader(value: string): string {
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized.length > 320) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}
