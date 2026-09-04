import { ReturnsAdminGatewayClient } from './returns-admin-gateway.client';

const ORIGINAL_ENV = process.env;
const TOKEN = 't'.repeat(48);

describe('ReturnsAdminGatewayClient', () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      AI_ARMAN_RETURNS_ADMIN_GATEWAY_ENABLED: 'true',
      AI_ARMAN_RETURNS_ADMIN_GATEWAY_BASE_URL:
        'https://harmoniq-returns-api-abc-lz.a.run.app',
      AI_ARMAN_RETURNS_ADMIN_GATEWAY_AUDIENCE:
        'https://harmoniq-returns-api-abc-lz.a.run.app',
      AI_ARMAN_RETURNS_ADMIN_GATEWAY_ACCESS_TOKEN: TOKEN,
      AI_ARMAN_RETURNS_ADMIN_WRITE_ENABLED: 'false',
    };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  it('blocks writes before auth when AI-side writes are disabled', async () => {
    const authProvider = { getHeaders: jest.fn() } as any;
    const client = new ReturnsAdminGatewayClient(authProvider);

    const result = await client.execute({
      method: 'PATCH',
      path: '/api/admin/cases/HQR-12345/work-queue',
      body: { queueState: 'waiting' },
      reason: 'Pause',
      explicitAdminApproval: true,
    });

    expect(result).toMatchObject({
      ok: false,
      error: 'returns_admin_gateway_write_disabled',
    });
    expect(authProvider.getHeaders).not.toHaveBeenCalled();
  });

  it('blocks writes without explicit admin approval', async () => {
    process.env.AI_ARMAN_RETURNS_ADMIN_WRITE_ENABLED = 'true';
    const authProvider = { getHeaders: jest.fn() } as any;
    const client = new ReturnsAdminGatewayClient(authProvider);

    const result = await client.execute({
      method: 'PATCH',
      path: '/api/admin/cases/HQR-12345/work-queue',
      body: { queueState: 'waiting' },
      reason: 'Pause',
    });

    expect(result).toMatchObject({
      ok: false,
      error: 'returns_admin_gateway_write_requires_approval',
    });
    expect(authProvider.getHeaders).not.toHaveBeenCalled();
  });

  it('uses Cloud Run identity and a separate app token for reads', async () => {
    const authProvider = {
      getHeaders: jest.fn().mockResolvedValue({
        ok: true,
        mode: 'google_metadata_identity_token',
        headers: { Authorization: 'Bearer identity.jwt.token' },
      }),
    } as any;
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          requestId: 'req-1',
          method: 'GET',
          path: '/api/cases',
          upstreamStatus: 200,
          contentType: 'application/json',
          body: { ok: true, cases: [] },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const client = new ReturnsAdminGatewayClient(authProvider);

    const result = await client.execute({
      method: 'GET',
      path: '/api/cases',
      reason: 'Read cases',
    });

    expect(result).toMatchObject({ ok: true, isWrite: false, upstreamStatus: 200 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      'Bearer identity.jwt.token',
    );
    expect((init?.headers as Record<string, string>)['X-AI-Arman-Admin-Token']).toBe(
      TOKEN,
    );
  });
});
