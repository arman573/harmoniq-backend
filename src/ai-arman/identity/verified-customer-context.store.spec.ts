import { createHash } from 'node:crypto';
import { VerifiedCustomerContextStore } from './verified-customer-context.store';

const NOW = new Date('2026-08-12T19:00:00.000Z');

describe('VerifiedCustomerContextStore', () => {
  it('issues an opaque backend-owned context without storing the raw subject', () => {
    const store = new VerifiedCustomerContextStore();
    const context = store.issue(
      {
        method: 'order_email_otp',
        subject: 'Customer@example.com ',
        verifiedOrderIds: ['90250'],
      },
      NOW,
    );

    expect(context.verificationId).toMatch(/^vcv_[0-9a-f-]{36}$/);
    expect(context.subjectHash).toBe(
      createHash('sha256').update('customer@example.com').digest('hex'),
    );
    expect(context.subjectHash).not.toContain('customer@example.com');
    expect(context.verifiedOrderIds).toEqual(['90250']);
    expect(context.verifiedAt).toBe('2026-08-12T19:00:00.000Z');
    expect(context.expiresAt).toBe('2026-08-12T19:15:00.000Z');
  });

  it('resolves only an active context bound to the requested order', () => {
    const store = new VerifiedCustomerContextStore();
    const issued = store.issue(
      {
        method: 'account_assertion',
        subject: 'customer-123',
        verifiedOrderIds: ['90250', '90251'],
      },
      NOW,
    );

    expect(store.resolve(issued.verificationId, '90251', NOW)).toEqual({
      ok: true,
      context: issued,
    });
    expect(store.resolve(issued.verificationId, '99999', NOW)).toEqual({
      ok: false,
      error: 'verification_order_mismatch',
    });
  });

  it('expires and deletes stale verification contexts', () => {
    const store = new VerifiedCustomerContextStore();
    const issued = store.issue(
      {
        method: 'order_email_otp',
        subject: 'customer@example.com',
        verifiedOrderIds: ['90250'],
        ttlMs: 60_000,
      },
      NOW,
    );

    const afterExpiry = new Date('2026-08-12T19:01:00.000Z');
    expect(store.resolve(issued.verificationId, '90250', afterExpiry)).toEqual({
      ok: false,
      error: 'verification_expired',
    });
    expect(store.resolve(issued.verificationId, '90250', afterExpiry)).toEqual({
      ok: false,
      error: 'verification_not_found',
    });
  });

  it('supports explicit revocation', () => {
    const store = new VerifiedCustomerContextStore();
    const issued = store.issue(
      {
        method: 'account_assertion',
        subject: 'customer-123',
        verifiedOrderIds: ['90250'],
      },
      NOW,
    );

    expect(store.revoke(issued.verificationId)).toBe(true);
    expect(store.resolve(issued.verificationId, '90250', NOW)).toEqual({
      ok: false,
      error: 'verification_not_found',
    });
  });

  it('rejects invalid, duplicate or excessive order bindings and unsafe ttl', () => {
    const store = new VerifiedCustomerContextStore();

    expect(() =>
      store.issue(
        {
          method: 'order_email_otp',
          subject: 'customer@example.com',
          verifiedOrderIds: ['90250', '90250'],
        },
        NOW,
      ),
    ).toThrow('verified_customer_orders_invalid');

    expect(() =>
      store.issue(
        {
          method: 'order_email_otp',
          subject: 'customer@example.com',
          verifiedOrderIds: ['not-an-order'],
        },
        NOW,
      ),
    ).toThrow('verified_customer_orders_invalid');

    expect(() =>
      store.issue(
        {
          method: 'order_email_otp',
          subject: 'customer@example.com',
          verifiedOrderIds: Array.from({ length: 41 }, (_, i) => String(10000 + i)),
        },
        NOW,
      ),
    ).toThrow('verified_customer_orders_invalid');

    expect(() =>
      store.issue(
        {
          method: 'order_email_otp',
          subject: 'customer@example.com',
          verifiedOrderIds: ['90250'],
          ttlMs: 31 * 60 * 1000,
        },
        NOW,
      ),
    ).toThrow('verified_customer_ttl_invalid');
  });

  it('returns cloned contexts so callers cannot mutate stored authorization', () => {
    const store = new VerifiedCustomerContextStore();
    const issued = store.issue(
      {
        method: 'account_assertion',
        subject: 'customer-123',
        verifiedOrderIds: ['90250'],
      },
      NOW,
    );

    issued.verifiedOrderIds.push('99999');
    const resolved = store.resolve(issued.verificationId, '90250', NOW);

    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.context.verifiedOrderIds).toEqual(['90250']);
    }
  });
});
