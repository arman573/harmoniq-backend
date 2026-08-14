import { readTrackingReadConfig } from './tracking-read.config';
import { TrackingReadClient } from './tracking-read.client';

jest.mock('./tracking-read.config', () => ({
  readTrackingReadConfig: jest.fn(),
}));

const readConfig = readTrackingReadConfig as jest.MockedFunction<
  typeof readTrackingReadConfig
>;

function allowRead() {
  readConfig.mockReturnValue({
    enabled: true,
    baseUrl: 'https://tracking.example.test',
    activationAllowed: true,
    reason: 'tracking_read_allowed',
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function validTracking(overrides: Record<string, unknown> = {}) {
  return {
    orderId: 90250,
    deliveryMethod: 'DB Schenker',
    deliveryType: 'schenker',
    carrier: 'DB Schenker',
    shipmentStatus: 'In transit',
    trackingUrl: 'https://www.dbschenker.com/app/tracking-public?refNumber=ABC123',
    parcelNo: 'ABC123',
    available: true,
    message: null,
    orderStatus: 'Skickad',
    latestPublicComment: 'PII-like extra data must never leave the client',
    customerEmail: 'secret@example.test',
    ...overrides,
  };
}

describe('TrackingReadClient', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.AI_ARMAN_TRACKING_READ_TIMEOUT_MS;
  });

  it('fails closed before fetch when tracking read is disabled', async () => {
    readConfig.mockReturnValue({
      enabled: false,
      baseUrl: null,
      activationAllowed: false,
      reason: 'default_disabled',
    });
    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(new TrackingReadClient().getTracking('90250')).resolves.toEqual({
      ok: false,
      error: 'tracking_read_unavailable',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects invalid order references before fetch', async () => {
    allowRead();
    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(new TrackingReadClient().getTracking('../90250')).resolves.toEqual({
      ok: false,
      error: 'tracking_not_found',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('uses strict GET semantics and projects only approved tracking fields', async () => {
    allowRead();
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({ ok: true, orders: [validTracking()] }),
    );

    await expect(new TrackingReadClient().getTracking('90250')).resolves.toEqual({
      ok: true,
      tracking: {
        orderId: '90250',
        deliveryMethod: 'DB Schenker',
        deliveryType: 'schenker',
        carrier: 'DB Schenker',
        shipmentStatus: 'In transit',
        trackingUrl:
          'https://www.dbschenker.com/app/tracking-public?refNumber=ABC123',
        parcelNo: 'ABC123',
        available: true,
        message: null,
      },
    });

    const [url, options] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe(
      'https://tracking.example.test/api/customer-tracking?orderIds=90250',
    );
    expect(options).toMatchObject({ method: 'GET', redirect: 'error' });
  });

  it('maps an upstream 404 to tracking_not_found', async () => {
    allowRead();
    jest.spyOn(global, 'fetch').mockResolvedValue(jsonResponse({}, 404));

    await expect(new TrackingReadClient().getTracking('90250')).resolves.toEqual({
      ok: false,
      error: 'tracking_not_found',
    });
  });

  it('maps the real upstream available:false model to tracking_not_found', async () => {
    allowRead();
    jest.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({
        ok: true,
        orders: [
          validTracking({
            available: false,
            deliveryMethod: null,
            deliveryType: 'other',
            carrier: null,
            shipmentStatus: null,
            trackingUrl: null,
            parcelNo: null,
            message: 'Ordern kunde inte hittas just nu.',
          }),
        ],
      }),
    );

    await expect(new TrackingReadClient().getTracking('90250')).resolves.toEqual({
      ok: false,
      error: 'tracking_not_found',
    });
  });

  it('fails closed on upstream server errors', async () => {
    allowRead();
    jest.spyOn(global, 'fetch').mockResolvedValue(jsonResponse({}, 500));

    await expect(new TrackingReadClient().getTracking('90250')).resolves.toEqual({
      ok: false,
      error: 'tracking_read_unavailable',
    });
  });

  it('fails closed on invalid JSON, non-JSON content, or unexpected schema', async () => {
    allowRead();
    const fetchSpy = jest.spyOn(global, 'fetch');

    fetchSpy.mockResolvedValueOnce(
      new Response('{', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await expect(new TrackingReadClient().getTracking('90250')).resolves.toEqual({
      ok: false,
      error: 'tracking_read_unavailable',
    });

    fetchSpy.mockResolvedValueOnce(
      new Response('<html>not json</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }),
    );
    await expect(new TrackingReadClient().getTracking('90250')).resolves.toEqual({
      ok: false,
      error: 'tracking_read_unavailable',
    });

    fetchSpy.mockResolvedValueOnce(jsonResponse({ ok: true, orders: 'wrong' }));
    await expect(new TrackingReadClient().getTracking('90250')).resolves.toEqual({
      ok: false,
      error: 'tracking_not_found',
    });
  });

  it('fails closed on oversized responses', async () => {
    allowRead();
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, orders: [validTracking({ padding: 'x'.repeat(128_001) })] }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(new TrackingReadClient().getTracking('90250')).resolves.toEqual({
      ok: false,
      error: 'tracking_read_unavailable',
    });
  });

  it('fails closed when fetch aborts or rejects', async () => {
    allowRead();
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('aborted'));

    await expect(new TrackingReadClient().getTracking('90250')).resolves.toEqual({
      ok: false,
      error: 'tracking_read_unavailable',
    });
  });
});
