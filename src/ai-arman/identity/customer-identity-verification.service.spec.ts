import { CustomerIdentityVerificationService } from './customer-identity-verification.service';
import {
  AccountOrderVerificationProvider,
  OrderEmailOtpVerificationProvider,
} from './customer-identity-verification.providers';
import { VerifiedCustomerContextStore } from './verified-customer-context.store';

const NOW = new Date('2026-08-12T20:00:00.000Z');

function serviceWith(params?: {
  otp?: jest.Mock;
  account?: jest.Mock;
}) {
  const otp = {
    verify:
      params?.otp ||
      jest.fn().mockResolvedValue({
        ok: false,
        error: 'verification_unavailable',
      }),
  } as unknown as OrderEmailOtpVerificationProvider;
  const account = {
    verify:
      params?.account ||
      jest.fn().mockResolvedValue({
        ok: false,
        error: 'verification_unavailable',
      }),
  } as unknown as AccountOrderVerificationProvider;

  return {
    otp,
    account,
    service: new CustomerIdentityVerificationService(
      new VerifiedCustomerContextStore(),
      otp,
      account,
    ),
  };
}

describe('CustomerIdentityVerificationService', () => {
  it('fails closed when OTP verification is unavailable', async () => {
    const { service } = serviceWith();

    await expect(
      service.verifyOrderEmailOtp(
        {
          verificationAttemptId: 'attempt-1',
          code: '123456',
          orderId: '90250',
        },
        NOW,
      ),
    ).resolves.toEqual({
      ok: false,
      error: 'verification_unavailable',
    });
  });

  it('issues a short-lived order-bound context only from a successful OTP provider result', async () => {
    const otp = jest.fn().mockResolvedValue({
      ok: true,
      subject: 'Customer@Example.com',
      verifiedOrderIds: ['90250'],
    });
    const { service } = serviceWith({ otp });

    const result = await service.verifyOrderEmailOtp(
      {
        verificationAttemptId: 'attempt-1',
        code: '123456',
        orderId: '90250',
      },
      NOW,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.verificationMethod).toBe('order_email_otp');
      expect(result.context.verifiedOrderIds).toEqual(['90250']);
      expect(result.context.subjectHash).toMatch(/^[a-f0-9]{64}$/);
      expect(result.context.expiresAt).toBe('2026-08-12T20:15:00.000Z');
    }
  });

  it('rejects a provider result that is not bound to the requested order', async () => {
    const otp = jest.fn().mockResolvedValue({
      ok: true,
      subject: 'customer@example.com',
      verifiedOrderIds: ['90251'],
    });
    const { service } = serviceWith({ otp });

    await expect(
      service.verifyOrderEmailOtp(
        {
          verificationAttemptId: 'attempt-1',
          code: '123456',
          orderId: '90250',
        },
        NOW,
      ),
    ).resolves.toEqual({
      ok: false,
      error: 'verification_binding_invalid',
    });
  });

  it('issues account assertion context only from backend provider ownership proof', async () => {
    const account = jest.fn().mockResolvedValue({
      ok: true,
      subject: 'customer-123',
      verifiedOrderIds: ['90250', '90251'],
    });
    const { service } = serviceWith({ account });

    const result = await service.verifyAccountOrder(
      {
        authenticatedSubject: 'customer-123',
        orderId: '90251',
      },
      NOW,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.verificationMethod).toBe('account_assertion');
      expect(result.context.verifiedOrderIds).toEqual(['90250', '90251']);
    }
  });

  it('does not silently trust the caller-supplied account subject', async () => {
    const account = jest.fn().mockResolvedValue({
      ok: false,
      error: 'verification_rejected',
    });
    const { service } = serviceWith({ account });

    await expect(
      service.verifyAccountOrder(
        {
          authenticatedSubject: 'attacker-supplied-subject',
          orderId: '90250',
        },
        NOW,
      ),
    ).resolves.toEqual({
      ok: false,
      error: 'verification_rejected',
    });
  });
});
