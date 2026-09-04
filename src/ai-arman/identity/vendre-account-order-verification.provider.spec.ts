import { VendreAccountOrderVerificationProvider } from './vendre-account-order-verification.provider';

const ENV_KEYS = [
  'AI_ARMAN_VENDRE_ACCOUNT_ORDER_VERIFICATION_ENABLED',
  'AI_ARMAN_VENDRE_ACCOUNT_ORDER_TIMEOUT_MS',
  'VENDRE_API_BASE_URL',
  'VENDRE_API_KEY',
] as const;

type EnvKey = (typeof ENV_KEYS)[number];
const originalEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<EnvKey, string | undefined>;

function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

function restoreEnv() {
  clearEnv();
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value !== undefined) process.env[key] = value;
  }
}

function enableProvider() {
  process.env.AI_ARMAN_VENDRE_ACCOUNT_ORDER_VERIFICATION_ENABLED = 'true';
  process.env.VENDRE_API_BASE_URL = 'https://www.harmoniq.se';
  process.env.VENDRE_API_KEY = 'test-key';
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('VendreAccountOrderVerificationProvider', () => {
  beforeEach(() => clearEnv());

  afterEach(() => {
    restoreEnv();
    jest.restoreAllMocks();
  });

  it('fails closed without opt-in and makes no request', async () => {
    process.env.VENDRE_API_BASE_URL = 'https://www.harmoniq.se';
    process.env.VENDRE_API_KEY = 'test-key';
    const fetchSpy = jest.spyOn(global, 'fetch');
    const provider = new VendreAccountOrderVerificationProvider();

    await expect(
      provider.verify({
        authenticatedSubject: 'customer@example.com',
        orderId: '90250',
      }),
    ).resolves.toEqual({ ok: false, error: 'verification_unavailable' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('verifies only the exact requested order when authenticated email matches Vendre', async () => {
    enableProvider();
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({
        id: 90250,
        customer: { email: 'customer@example.com', name: 'Sensitive Name' },
        products: [{ id: 1, name: 'Sensitive Product' }],
        billing_address: { email_address: 'billing@example.com' },
      }),
    );
    const provider = new VendreAccountOrderVerificationProvider();

    await expect(
      provider.verify({
        authenticatedSubject: ' Customer@Example.com ',
        orderId: '90250',
      }),
    ).resolves.toEqual({
      ok: true,
      subject: 'customer@example.com',
      verifiedOrderIds: ['90250'],
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe('https://www.harmoniq.se/API/1/orders/90250');
    expect(options).toMatchObject({
      method: 'GET',
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        'X-Authorization': 'test-key',
      },
    });
  });

  it('rejects an authenticated email that does not belong to the order', async () => {
    enableProvider();
    jest.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({ id: 90250, customer: { email: 'owner@example.com' } }),
    );
    const provider = new VendreAccountOrderVerificationProvider();

    await expect(
      provider.verify({
        authenticatedSubject: 'other@example.com',
        orderId: '90250',
      }),
    ).resolves.toEqual({ ok: false, error: 'verification_rejected' });
  });

  it('rejects a response whose order id is not the requested order', async () => {
    enableProvider();
    jest.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({ id: 90251, customer: { email: 'customer@example.com' } }),
    );
    const provider = new VendreAccountOrderVerificationProvider();

    await expect(
      provider.verify({
        authenticatedSubject: 'customer@example.com',
        orderId: '90250',
      }),
    ).resolves.toEqual({ ok: false, error: 'verification_rejected' });
  });

  it('rejects invalid caller input before any Vendre request', async () => {
    enableProvider();
    const fetchSpy = jest.spyOn(global, 'fetch');
    const provider = new VendreAccountOrderVerificationProvider();

    await expect(
      provider.verify({ authenticatedSubject: 'not-an-email', orderId: '../90250' }),
    ).resolves.toEqual({ ok: false, error: 'verification_rejected' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fails closed on an oversized response', async () => {
    enableProvider();
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 90250, padding: 'x'.repeat(256_001) }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const provider = new VendreAccountOrderVerificationProvider();

    await expect(
      provider.verify({
        authenticatedSubject: 'customer@example.com',
        orderId: '90250',
      }),
    ).resolves.toEqual({ ok: false, error: 'verification_unavailable' });
  });

  it('bounds upstream failures without leaking details', async () => {
    enableProvider();
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('secret upstream detail'));
    const provider = new VendreAccountOrderVerificationProvider();

    await expect(
      provider.verify({
        authenticatedSubject: 'customer@example.com',
        orderId: '90250',
      }),
    ).resolves.toEqual({ ok: false, error: 'verification_unavailable' });
  });
});
