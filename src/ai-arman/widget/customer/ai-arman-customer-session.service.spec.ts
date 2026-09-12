import { AiArmanCustomerSessionService } from './ai-arman-customer-session.service';
import { AiArmanCustomerWidgetConfig } from './ai-arman-customer-widget.config';

function config() {
  return {
    sessionSecret: jest.fn(() => 's'.repeat(48)),
    sessionTtlMs: jest.fn(() => 30 * 60 * 1000),
  } as unknown as AiArmanCustomerWidgetConfig;
}

describe('AiArmanCustomerSessionService', () => {
  it('issues an opaque encrypted token that does not expose the customer subject', () => {
    const service = new AiArmanCustomerSessionService(config());
    const email = 'kund@example.se';
    const token = service.issue(email, 1_900_000_000_000);

    expect(token).toBeTruthy();
    if (!token) throw new Error('token_missing');
    expect(token.startsWith('aia2.')).toBe(true);
    expect(token).not.toContain(email);
    expect(Buffer.from(token, 'base64url').toString('utf8')).not.toContain(email);
    expect(service.verify(token, 1_900_000_001_000)).toEqual(
      expect.objectContaining({ v: 2, sub: email }),
    );
  });

  it('rejects a token when any encrypted segment is tampered with', () => {
    const service = new AiArmanCustomerSessionService(config());
    const token = service.issue('kund@example.se', 1_900_000_000_000);
    if (!token) throw new Error('token_missing');

    const parts = token.split('.');
    parts[2] = `${parts[2].slice(0, -1)}${parts[2].endsWith('A') ? 'B' : 'A'}`;
    expect(service.verify(parts.join('.'), 1_900_000_001_000)).toBeNull();
  });

  it('rejects expired tokens', () => {
    const service = new AiArmanCustomerSessionService(config());
    const token = service.issue('kund@example.se', 1_900_000_000_000);
    if (!token) throw new Error('token_missing');

    expect(service.verify(token, 1_900_001_800_001)).toBeNull();
  });
});
