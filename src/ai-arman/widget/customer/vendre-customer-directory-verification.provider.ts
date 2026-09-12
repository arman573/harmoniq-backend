import { Injectable } from '@nestjs/common';
import { normalizeVendreHttpsBaseUrl } from '../../integrations/vendre-base-url.policy';
import {
  CustomerDirectoryVerificationProvider,
  type CustomerDirectoryVerificationResult,
} from './ai-arman-customer-identity.providers';

const MAX_RESPONSE_BYTES = 256_000;
const DEFAULT_TIMEOUT_MS = 1500;

@Injectable()
export class VendreCustomerDirectoryVerificationProvider extends CustomerDirectoryVerificationProvider {
  async verifyEmail(emailInput: string): Promise<CustomerDirectoryVerificationResult> {
    const config = readConfig();
    if (!config.enabled || !config.baseUrl || !config.apiKey) {
      return { ok: false, error: 'verification_unavailable' };
    }

    const email = normalizeEmail(emailInput);
    if (!email) return { ok: false, error: 'customer_not_found' };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const url = new URL('/API/1/customer', `${config.baseUrl}/`);
      url.searchParams.set('match', email);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-Authorization': config.apiKey,
        },
        redirect: 'error',
        signal: controller.signal,
      });

      if (!response.ok) {
        return response.status >= 500
          ? { ok: false, error: 'verification_unavailable' }
          : { ok: false, error: 'customer_not_found' };
      }

      const body = await readBoundedJson(response);
      const records = collectionRecords(body);
      const matched = records.some((record) =>
        collectEmails(record).includes(email),
      );

      return matched
        ? { ok: true, subject: email }
        : { ok: false, error: 'customer_not_found' };
    } catch {
      return { ok: false, error: 'verification_unavailable' };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const enabled =
    String(env.AI_ARMAN_VENDRE_CUSTOMER_DIRECTORY_ENABLED || '')
      .trim()
      .toLowerCase() === 'true';
  const baseUrl = normalizeVendreHttpsBaseUrl(env.VENDRE_API_BASE_URL);
  const apiKey = String(env.VENDRE_API_KEY || '').trim();
  const configuredTimeout = Number(env.AI_ARMAN_VENDRE_CUSTOMER_DIRECTORY_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(configuredTimeout)
    ? Math.min(5000, Math.max(300, configuredTimeout))
    : DEFAULT_TIMEOUT_MS;
  return { enabled, baseUrl, apiKey, timeoutMs };
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    throw new Error('response_too_large');
  }
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
    throw new Error('response_too_large');
  }
  return JSON.parse(text);
}

function collectionRecords(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];
  if (Array.isArray(value.data)) return value.data.filter(isRecord);
  if (Array.isArray(value.customers)) return value.customers.filter(isRecord);
  return [value];
}

function collectEmails(record: Record<string, unknown>): string[] {
  const candidates = [
    record.email,
    record.email_address,
    record.emailAddress,
    record.customer_email,
    record.customerEmail,
  ];
  return [...new Set(candidates.map(normalizeEmail).filter(isString))];
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized.length > 320) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: string | null): value is string {
  return typeof value === 'string';
}
