import { ReturnsModuleReadClient } from './returns-module-read.client';
import {
  RETURNS_MODULE_CONTRACT_VERSION,
  ReturnsModuleCaseContextRequest,
} from './returns-module.types';

const ENV_KEYS = [
  'AI_ARMAN_RETURNS_MODULE_READ_ENABLED',
  'AI_ARMAN_RETURNS_MODULE_BASE_URL',
  'AI_ARMAN_RETURNS_MODULE_ACCESS_TOKEN',
  'AI_ARMAN_RETURNS_MODULE_TIMEOUT_MS',
] as const;

const originalEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);

function restoreEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value !== undefined) process.env[key] = value;
  }
}

function enableClient() {
  process.env.AI_ARMAN_RETURNS_MODULE_READ_ENABLED = 'true';
  process.env.AI_ARMAN_RETURNS_MODULE_BASE_URL = 'https://returns.example.com';
  process.env.AI_ARMAN_RETURNS_MODULE_ACCESS_TOKEN = 'a'.repeat(64);
}

function request(): ReturnsModuleCaseContextRequest {
  const now = Date.now();
  return {
    contractVersion: RETURNS_MODULE_CONTRACT_VERSION,
    orderId: '90250',
    caseId: 'HQR-90250',
    verification: {
      verificationId: 'verify-123',
      verificationMethod: 'order_email_otp',
      subjectHash: 'b'.repeat(64),
      verifiedOrderIds: ['90250'],
      verifiedAt: new Date(now - 60_000).toISOString(),
      expiresAt: new Date(now + 5 * 60_000).toISOString(),
    },
  };
}

describe('ReturnsModuleReadClient', () => {
  afterEach(() => {
    restoreEnv();
    jest.restoreAllMocks();
  });

  it('makes no network call while disabled', async () => {
    for (const key of ENV_KEYS) delete process.env[key];
    const fetchSpy = jest.spyOn(global, 'fetch');

    const result = await new ReturnsModuleReadClient().getCaseContext(request());

    expect(result).toEqual({
      ok: false,
      configured: false,
      durationMs: 0,
      error: 'returns_module_read_disabled',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts only to the fixed internal read endpoint with dedicated bearer auth', async () => {
    enableClient();
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          contractVersion: RETURNS_MODULE_CONTRACT_VERSION,
          orderId: '90250',
          cases: [
            {
              caseId: 'HQR-90250',
              orderId: '90250',
              caseType: 'claim',
              status: 'chat_waiting_admin',
              statusLabel: 'Chat: väntar på admin',
              createdAt: '2026-08-12T17:00:00.000Z',
              updatedAt: '2026-08-12T17:30:00.000Z',
              messages: [],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await new ReturnsModuleReadClient().getCaseContext(request());

    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(
      'https://returns.example.com/api/internal/ai-arman/cases/context',
    );
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${'a'.repeat(64)}`,
    });
    expect(JSON.parse(String(init?.body))).toEqual(request());
  });

  it('fails closed when the upstream response breaks the contract', async () => {
    enableClient();
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          contractVersion: RETURNS_MODULE_CONTRACT_VERSION,
          orderId: '99999',
          cases: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await new ReturnsModuleReadClient().getCaseContext(request());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('returns_module_contract_invalid');
  });

  it('does not expose an upstream error payload as a successful contract', async () => {
    enableClient();
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ secret: 'should-not-propagate' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await new ReturnsModuleReadClient().getCaseContext(request());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('returns_module_upstream_error');
      expect(JSON.stringify(result)).not.toContain('should-not-propagate');
    }
  });
});
