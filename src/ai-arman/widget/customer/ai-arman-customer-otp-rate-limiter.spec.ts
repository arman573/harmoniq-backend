import { AiArmanCustomerOtpRateLimiter } from './ai-arman-customer-otp-rate-limiter';

describe('AiArmanCustomerOtpRateLimiter', () => {
  it('enforces a resend cooldown per normalized email without storing plaintext email keys', () => {
    const limiter = new AiArmanCustomerOtpRateLimiter();
    expect(limiter.allow('Kund@Example.se', 100_000)).toBe(true);
    expect(limiter.allow(' kund@example.se ', 120_000)).toBe(false);
    expect(limiter.allow('kund@example.se', 161_000)).toBe(true);
  });

  it('limits repeated sends within the subject window', () => {
    const limiter = new AiArmanCustomerOtpRateLimiter();
    expect(limiter.allow('kund@example.se', 0)).toBe(true);
    expect(limiter.allow('kund@example.se', 61_000)).toBe(true);
    expect(limiter.allow('kund@example.se', 122_000)).toBe(true);
    expect(limiter.allow('kund@example.se', 183_000)).toBe(false);
    expect(limiter.allow('kund@example.se', 901_000)).toBe(true);
  });
});
