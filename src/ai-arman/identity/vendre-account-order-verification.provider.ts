import { Injectable } from '@nestjs/common';
import {
  AccountOrderAssertion,
  AccountOrderVerificationProvider,
  VerifiedOrderOwnership,
} from './customer-identity-verification.providers';
import { readAccountOrderVerificationConfig } from './account-order-verification.config';

const ORDER_ID_PATTERN = /^[0-9]{3,12}$/;
const DEFAULT_TIMEOUT_MS = 1500;
const MAX_RESPONSE_BYTES = 256_000;

type UnknownRecord = Record<string, unknown>;

@Injectable()
export class VendreAccountOrderVerificationProvider
  extends AccountOrderVerificationProvider
{
  async verify(
    assertion: AccountOrderAssertion,
  ): Promise<VerifiedOrderOwnership> {
    const config = readAccountOrderVerificationConfig();
    if (!config.activationAllowed || !config.baseUrl || !config.apiKey) {
      return { ok: false, error: 'verification_unavailable' };
    }

    const orderId = String(assertion.orderId || '').trim();
    const authenticatedEmail = normalizeEmail(assertion.authenticatedSubject);
    if (!ORDER_ID_PATTERN.test(orderId) || !authenticatedEmail) {
      return { ok: false, error: 'verification_rejected' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), readTimeout());

    try {
      const url = new URL(
        `/API/1/orders/${encodeURIComponent(orderId)}`,
        `${config.baseUrl}/`,
      );
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
        return { ok: false, error: 'verification_rejected' };
      }

      const body = await readBoundedJson(response);
      const order = unwrapRecord(body);
      if (!order || String(order.id || '').trim() !== orderId) {
        return { ok: false, error: 'verification_rejected' };
      }

      const orderEmails = collectOrderEmails(order);
      if (!orderEmails.includes(authenticatedEmail)) {
        return { ok: false, error: 'verification_rejected' };
      }

      return {
        ok: true,
        subject: authenticatedEmail,
        verifiedOrderIds: [orderId],
      };
    } catch {
      return { ok: false, error: 'verification_unavailable' };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function readTimeout(): number {
  const configured = Number(process.env.AI_ARMAN_VENDRE_ACCOUNT_ORDER_TIMEOUT_MS);
  if (!Number.isFinite(configured)) return DEFAULT_TIMEOUT_MS;
  return Math.min(5000, Math.max(300, configured));
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

function unwrapRecord(value: unknown): UnknownRecord | null {
  if (!isRecord(value)) return null;
  return isRecord(value.data) ? value.data : value;
}

function collectOrderEmails(order: UnknownRecord): string[] {
  const customer = asRecord(order.customer);
  const billingAddress = asRecord(order.billing_address);
  const customerAddress = asRecord(order.customer_address);
  const deliveryAddress = asRecord(order.delivery_address);
  const billingAddressCamel = asRecord(order.billingAddress);
  const customerAddressCamel = asRecord(order.customerAddress);
  const deliveryAddressCamel = asRecord(order.deliveryAddress);

  const candidates = [
    order.email,
    order.email_address,
    order.customer_email,
    order.customers_email_address,
    customer?.email,
    customer?.email_address,
    customer?.customers_email_address,
    billingAddress?.email_address,
    billingAddress?.email,
    customerAddress?.email_address,
    customerAddress?.email,
    deliveryAddress?.email_address,
    deliveryAddress?.email,
    billingAddressCamel?.email_address,
    billingAddressCamel?.email,
    customerAddressCamel?.email_address,
    customerAddressCamel?.email,
    deliveryAddressCamel?.email_address,
    deliveryAddressCamel?.email,
  ];

  return [...new Set(candidates.map(normalizeEmail).filter(isString))];
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized.length > 320) return null;
  if (/[^\x20-\x7e]/.test(normalized)) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  return normalized;
}

function asRecord(value: unknown): UnknownRecord | null {
  return isRecord(value) ? value : null;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: string | null): value is string {
  return typeof value === 'string';
}
