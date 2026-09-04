import { VendreCustomerDirectoryVerificationProvider } from './vendre-customer-directory-verification.provider';

describe('VendreCustomerDirectoryVerificationProvider', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('is unavailable unless explicitly enabled', async () => {
    delete process.env.AI_ARMAN_VENDRE_CUSTOMER_DIRECTORY_ENABLED;
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      new VendreCustomerDirectoryVerificationProvider().verifyEmail('kund@example.se'),
    ).resolves.toEqual({ ok: false, error: 'verification_unavailable' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('verifies an exact normalized customer email through Vendre', async () => {
    process.env.AI_ARMAN_VENDRE_CUSTOMER_DIRECTORY_ENABLED = 'true';
    process.env.VENDRE_API_BASE_URL = 'https://shop.example.test';
    process.env.VENDRE_API_KEY = 'secret-test-key';
    global.fetch = jest.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      expect(String(input)).toBe('https://shop.example.test/API/1/customer?match=kund%40example.se');
      expect(init?.method).toBe('GET');
      expect((init?.headers as Record<string, string>)['X-Authorization']).toBe('secret-test-key');
      return new Response(JSON.stringify([{ id: 1, email: 'KUND@example.se' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    await expect(
      new VendreCustomerDirectoryVerificationProvider().verifyEmail(' Kund@Example.se '),
    ).resolves.toEqual({ ok: true, subject: 'kund@example.se' });
  });

  it('rejects a response that does not contain the requested customer email', async () => {
    process.env.AI_ARMAN_VENDRE_CUSTOMER_DIRECTORY_ENABLED = 'true';
    process.env.VENDRE_API_BASE_URL = 'https://shop.example.test';
    process.env.VENDRE_API_KEY = 'secret-test-key';
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify([{ id: 2, email: 'annan@example.se' }]), {
        status: 200,
      }),
    ) as unknown as typeof fetch;

    await expect(
      new VendreCustomerDirectoryVerificationProvider().verifyEmail('kund@example.se'),
    ).resolves.toEqual({ ok: false, error: 'customer_not_found' });
  });

  it('fails closed for oversized or malformed upstream responses', async () => {
    process.env.AI_ARMAN_VENDRE_CUSTOMER_DIRECTORY_ENABLED = 'true';
    process.env.VENDRE_API_BASE_URL = 'https://shop.example.test';
    process.env.VENDRE_API_KEY = 'secret-test-key';
    global.fetch = jest.fn(async () =>
      new Response('{', { status: 200 }),
    ) as unknown as typeof fetch;

    await expect(
      new VendreCustomerDirectoryVerificationProvider().verifyEmail('kund@example.se'),
    ).resolves.toEqual({ ok: false, error: 'verification_unavailable' });
  });
});
