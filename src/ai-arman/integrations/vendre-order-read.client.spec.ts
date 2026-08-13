import { readVendreOrderReadConfig } from './vendre-order-read.config';
import { VendreOrderReadClient } from './vendre-order-read.client';

jest.mock('./vendre-order-read.config', () => ({
  readVendreOrderReadConfig: jest.fn(),
}));

const readConfig = readVendreOrderReadConfig as jest.MockedFunction<
  typeof readVendreOrderReadConfig
>;

function allowRead() {
  readConfig.mockReturnValue({
    enabled: true,
    baseUrl: 'https://example.test',
    apiKey: 'configured',
    activationAllowed: true,
    reason: 'vendre_order_read_allowed',
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('VendreOrderReadClient', () => {
  afterEach(() => jest.restoreAllMocks());

  it('fails closed before fetch when order read is disabled', async () => {
    readConfig.mockReturnValue({
      enabled: false,
      baseUrl: null,
      apiKey: '',
      activationAllowed: false,
      reason: 'default_disabled',
    });
    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(new VendreOrderReadClient().getOrder('90250')).resolves.toEqual({
      ok: false,
      error: 'order_read_unavailable',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('uses a strict GET request and returns only projected status facts', async () => {
    allowRead();
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({
        id: 90250,
        status_id: 3,
        status_name: 'Skickad',
        date_added: '2026-08-12T10:00:00Z',
        shipping_date: '2026-08-13T09:00:00Z',
        extra_field: 'not-projected',
      }),
    );

    await expect(new VendreOrderReadClient().getOrder('90250')).resolves.toEqual({
      ok: true,
      order: {
        orderId: '90250',
        status: 'Skickad',
        statusId: 3,
        createdAt: '2026-08-12T10:00:00Z',
        shippingDate: '2026-08-13T09:00:00Z',
        dispatchState: 'dispatched',
      },
    });

    const [url, options] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe('https://example.test/API/1/orders/90250');
    expect(options).toMatchObject({ method: 'GET', redirect: 'error' });
  });

  it('rejects invalid order references before fetch', async () => {
    allowRead();
    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(new VendreOrderReadClient().getOrder('../90250')).resolves.toEqual({
      ok: false,
      error: 'order_not_found',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('maps a missing order without leaking upstream data', async () => {
    allowRead();
    jest.spyOn(global, 'fetch').mockResolvedValue(jsonResponse({}, 404));

    await expect(new VendreOrderReadClient().getOrder('90250')).resolves.toEqual({
      ok: false,
      error: 'order_not_found',
    });
  });

  it('fails closed on oversized or failed upstream responses', async () => {
    allowRead();
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 90250, padding: 'x'.repeat(256_001) }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(new VendreOrderReadClient().getOrder('90250')).resolves.toEqual({
      ok: false,
      error: 'order_read_unavailable',
    });
  });
});
