import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import {
  ReturnsModuleVerificationMethod,
  ReturnsModuleVerifiedCustomerContext,
} from '../integrations/returns-module.types';

const DEFAULT_TTL_MS = 15 * 60 * 1000;
const MAX_TTL_MS = 30 * 60 * 1000;
const MAX_VERIFIED_ORDERS = 40;
const ORDER_ID_PATTERN = /^[0-9]{3,12}$/;

export type VerifiedCustomerAssertion = {
  method: ReturnsModuleVerificationMethod;
  subject: string;
  verifiedOrderIds: string[];
  verifiedAt?: Date;
  ttlMs?: number;
};

export type VerifiedCustomerContextResolution =
  | {
      ok: true;
      context: ReturnsModuleVerifiedCustomerContext;
    }
  | {
      ok: false;
      error:
        | 'verification_not_found'
        | 'verification_expired'
        | 'verification_order_mismatch';
    };

@Injectable()
export class VerifiedCustomerContextStore {
  private readonly contexts = new Map<
    string,
    ReturnsModuleVerifiedCustomerContext
  >();

  issue(
    assertion: VerifiedCustomerAssertion,
    now = new Date(),
  ): ReturnsModuleVerifiedCustomerContext {
    const subject = normalizeSubject(assertion.subject);
    if (!subject) {
      throw new Error('verified_customer_subject_invalid');
    }

    if (!['order_email_otp', 'account_assertion'].includes(assertion.method)) {
      throw new Error('verified_customer_method_invalid');
    }

    const verifiedOrderIds = normalizeOrderIds(assertion.verifiedOrderIds);
    if (!verifiedOrderIds) {
      throw new Error('verified_customer_orders_invalid');
    }

    const nowMs = now.getTime();
    if (!Number.isFinite(nowMs)) {
      throw new Error('verified_customer_clock_invalid');
    }

    const verifiedAt = assertion.verifiedAt || now;
    const verifiedAtMs = verifiedAt.getTime();
    if (!Number.isFinite(verifiedAtMs) || verifiedAtMs > nowMs + 30_000) {
      throw new Error('verified_customer_verified_at_invalid');
    }

    const ttlMs = normalizeTtl(assertion.ttlMs);
    const verificationId = `vcv_${randomUUID()}`;
    const context: ReturnsModuleVerifiedCustomerContext = {
      verificationId,
      verificationMethod: assertion.method,
      subjectHash: createHash('sha256').update(subject, 'utf8').digest('hex'),
      verifiedOrderIds,
      verifiedAt: new Date(verifiedAtMs).toISOString(),
      expiresAt: new Date(nowMs + ttlMs).toISOString(),
    };

    this.contexts.set(verificationId, context);
    return cloneContext(context);
  }

  resolve(
    verificationId: string,
    orderId: string,
    now = new Date(),
  ): VerifiedCustomerContextResolution {
    const context = this.contexts.get(String(verificationId || '').trim());
    if (!context) {
      return { ok: false, error: 'verification_not_found' };
    }

    const nowMs = now.getTime();
    const expiresAtMs = Date.parse(context.expiresAt);
    if (!Number.isFinite(nowMs) || !Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) {
      this.contexts.delete(context.verificationId);
      return { ok: false, error: 'verification_expired' };
    }

    const normalizedOrderId = String(orderId || '').trim();
    if (!context.verifiedOrderIds.includes(normalizedOrderId)) {
      return { ok: false, error: 'verification_order_mismatch' };
    }

    return { ok: true, context: cloneContext(context) };
  }

  revoke(verificationId: string): boolean {
    return this.contexts.delete(String(verificationId || '').trim());
  }

  clear(): void {
    this.contexts.clear();
  }
}

function normalizeSubject(value: unknown): string {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized || normalized.length > 320) return '';
  if (
    /[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/.test(
      normalized,
    )
  ) {
    return '';
  }
  return normalized;
}

function normalizeOrderIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_VERIFIED_ORDERS) {
    return null;
  }

  const normalized = value.map((item) => String(item || '').trim());
  if (normalized.some((orderId) => !ORDER_ID_PATTERN.test(orderId))) return null;
  if (new Set(normalized).size !== normalized.length) return null;
  return normalized;
}

function normalizeTtl(value: unknown): number {
  if (value === undefined) return DEFAULT_TTL_MS;
  const ttlMs = Number(value);
  if (!Number.isFinite(ttlMs) || ttlMs <= 0 || ttlMs > MAX_TTL_MS) {
    throw new Error('verified_customer_ttl_invalid');
  }
  return Math.trunc(ttlMs);
}

function cloneContext(
  context: ReturnsModuleVerifiedCustomerContext,
): ReturnsModuleVerifiedCustomerContext {
  return {
    ...context,
    verifiedOrderIds: [...context.verifiedOrderIds],
  };
}
