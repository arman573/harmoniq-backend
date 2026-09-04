import type {
  CustomerDirectoryVerificationProvider,
  CustomerEmailOtpSender,
} from './ai-arman-customer-identity.providers';
import { AiArmanCustomerIdentityService } from './ai-arman-customer-identity.service';
import { AiArmanCustomerIdentityStore } from './ai-arman-customer-identity.store';
import { AiArmanCustomerOtpRateLimiter } from './ai-arman-customer-otp-rate-limiter';
import { AiArmanCustomerSessionService } from './ai-arman-customer-session.service';
import { AiArmanCustomerWidgetConfig } from './ai-arman-customer-widget.config';

function config() {
  return {
    isWidgetEnabled: jest.fn(() => true),
    isIdentityEnabled: jest.fn(() => true),
    otpTtlMs: jest.fn(() => 600_000),
    sessionTtlMs: jest.fn(() => 1_800_000),
    maxOtpAttempts: jest.fn(() => 5),
    sessionSecret: jest.fn(() => 'x'.repeat(48)),
  } as unknown as AiArmanCustomerWidgetConfig;
}

function setup(directoryOk = true) {
  let deliveredCode = '';
  const sender = {
    send: jest.fn(async ({ code }: { code: string }) => {
      deliveredCode = code;
      return { ok: true as const };
    }),
  } as unknown as CustomerEmailOtpSender;
  const directory = {
    verifyEmail: jest.fn(async (email: string) =>
      directoryOk
        ? { ok: true as const, subject: email }
        : { ok: false as const, error: 'customer_not_found' as const },
    ),
  } as unknown as CustomerDirectoryVerificationProvider;
  const cfg = config();
  const store = new AiArmanCustomerIdentityStore();
  const rateLimiter = new AiArmanCustomerOtpRateLimiter();
  const sessions = new AiArmanCustomerSessionService(cfg);
  const identity = new AiArmanCustomerIdentityService(
    cfg,
    store,
    rateLimiter,
    sender,
    directory,
    sessions,
  );
  return {
    identity,
    sender,
    directory,
    sessions,
    rateLimiter,
    getCode: () => deliveredCode,
  };
}

describe('AiArmanCustomerIdentityService', () => {
  it('issues a short-lived encrypted session only after OTP and customer directory verification', async () => {
    const { identity, directory, sessions, getCode } = setup(true);
    const now = 1_900_000_000_000;

    const started = await identity.start(' Kund@Example.se ', now);
    expect(started.ok).toBe(true);
    if (!started.ok) throw new Error('start_failed');
    expect(getCode()).toMatch(/^\d{6}$/);

    const verified = await identity.verify(
      { challengeId: started.challengeId, code: getCode() },
      now + 1000,
    );
    expect(verified.ok).toBe(true);
    if (!verified.ok) throw new Error('verify_failed');
    expect(directory.verifyEmail).toHaveBeenCalledWith('kund@example.se');
    expect(sessions.verify(verified.sessionToken, now + 2000)).toEqual(
      expect.objectContaining({ sub: 'kund@example.se', v: 2 }),
    );
  });

  it('rejects an incorrect code and never checks the customer directory', async () => {
    const { identity, directory } = setup(true);
    const started = await identity.start('kund@example.se', 10_000);
    if (!started.ok) throw new Error('start_failed');

    await expect(
      identity.verify({ challengeId: started.challengeId, code: '000000' }, 11_000),
    ).resolves.toEqual({ ok: false, code: 'verification_rejected' });
    expect(directory.verifyEmail).not.toHaveBeenCalled();
  });

  it('does not issue a session when the verified email is not a known customer', async () => {
    const { identity, getCode } = setup(false);
    const started = await identity.start('kund@example.se', 20_000);
    if (!started.ok) throw new Error('start_failed');

    await expect(
      identity.verify({ challengeId: started.challengeId, code: getCode() }, 21_000),
    ).resolves.toEqual({ ok: false, code: 'verification_rejected' });
  });

  it('consumes the challenge after a successful verification', async () => {
    const { identity, getCode } = setup(true);
    const started = await identity.start('kund@example.se', 30_000);
    if (!started.ok) throw new Error('start_failed');

    const first = await identity.verify(
      { challengeId: started.challengeId, code: getCode() },
      31_000,
    );
    expect(first.ok).toBe(true);
    await expect(
      identity.verify({ challengeId: started.challengeId, code: getCode() }, 32_000),
    ).resolves.toEqual({ ok: false, code: 'verification_rejected' });
  });

  it('rate limits repeated OTP sends before another email is sent', async () => {
    const { identity, sender } = setup(true);
    const first = await identity.start('kund@example.se', 100_000);
    expect(first.ok).toBe(true);

    await expect(
      identity.start('kund@example.se', 120_000),
    ).resolves.toEqual({ ok: false, code: 'rate_limited' });
    expect(sender.send).toHaveBeenCalledTimes(1);
  });
});
