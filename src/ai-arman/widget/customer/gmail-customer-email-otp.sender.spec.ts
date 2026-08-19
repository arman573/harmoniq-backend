import { GmailCustomerEmailOtpSender } from './gmail-customer-email-otp.sender';

describe('GmailCustomerEmailOtpSender', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('does not call Gmail unless explicitly enabled', async () => {
    delete process.env.AI_ARMAN_CUSTOMER_OTP_EMAIL_ENABLED;
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      new GmailCustomerEmailOtpSender().send({
        email: 'kund@example.se',
        code: '123456',
        expiresAt: new Date().toISOString(),
      }),
    ).resolves.toEqual({ ok: false, error: 'delivery_unavailable' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes OAuth and sends only the OTP message through Gmail', async () => {
    process.env.AI_ARMAN_CUSTOMER_OTP_EMAIL_ENABLED = 'true';
    process.env.GMAIL_CLIENT_ID = 'client-id';
    process.env.GMAIL_CLIENT_SECRET = 'client-secret';
    process.env.GMAIL_REFRESH_TOKEN = 'refresh-token';
    process.env.AI_ARMAN_CUSTOMER_OTP_FROM_EMAIL = 'noreply@harmoniq.se';

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'oauth-access-token' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'message-id' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      new GmailCustomerEmailOtpSender().send({
        email: 'kund@example.se',
        code: '123456',
        expiresAt: '2030-01-01T12:00:00.000Z',
      }),
    ).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe('https://oauth2.googleapis.com/token');
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    );
    const gmailInit = fetchMock.mock.calls[1][1] as RequestInit;
    expect((gmailInit.headers as Record<string, string>).Authorization).toBe(
      'Bearer oauth-access-token',
    );
    const requestBody = JSON.parse(String(gmailInit.body)) as { raw: string };
    const decoded = Buffer.from(requestBody.raw, 'base64url').toString('utf8');
    expect(decoded).toContain('To: kund@example.se');
    expect(decoded).toContain('123456');
    expect(decoded).not.toContain('client-secret');
    expect(decoded).not.toContain('refresh-token');
  });

  it('fails closed when Gmail credentials or upstream delivery are unavailable', async () => {
    process.env.AI_ARMAN_CUSTOMER_OTP_EMAIL_ENABLED = 'true';
    delete process.env.GMAIL_CLIENT_SECRET;
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      new GmailCustomerEmailOtpSender().send({
        email: 'kund@example.se',
        code: '123456',
        expiresAt: new Date().toISOString(),
      }),
    ).resolves.toEqual({ ok: false, error: 'delivery_unavailable' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
