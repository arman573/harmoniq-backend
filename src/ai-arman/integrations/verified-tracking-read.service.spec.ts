import { ConversationCustomerVerificationStore } from '../identity/conversation-customer-verification.store';
import { VerifiedCustomerContextStore } from '../identity/verified-customer-context.store';
import type { TrackingReadClient } from './tracking-read.client';
import type { VendreOrderReadClient } from './vendre-order-read.client';
import { VerifiedTrackingReadService } from './verified-tracking-read.service';

const NOW = new Date('2026-08-14T10:00:00.000Z');
const FUTURE = '2026-08-14T10:20:00.000Z';

function fallbackTracking() {
  return {
    ok: true as const,
    tracking: {
      orderId: '90250',
      deliveryMethod: 'DB Schenker',
      deliveryType: 'schenker' as const,
      carrier: 'DB Schenker',
      shipmentStatus: 'In transit',
      trackingUrl: 'https://tracking.example.test/parcel/123',
      parcelNo: '123',
      available: true,
      message: null,
    },
  };
}

function vendreOrder(overrides = {}) {
  return {
    ok: true as const,
    order: {
      orderId: '90250',
      status: 'Skickad',
      statusId: 3,
      createdAt: '2026-08-14T08:00:00Z',
      shippingDate: '2026-08-14T09:00:00Z',
      dispatchState: 'dispatched' as const,
      trackingNumber: '',
      trackingUrl: '',
      shipmentStatus: '',
      ...overrides,
    },
  };
}

function build() {
  const conversationStore = new ConversationCustomerVerificationStore();
  const verifiedStore = new VerifiedCustomerContextStore();
  const getTracking = jest.fn().mockResolvedValue(fallbackTracking());
  const trackingClient = { getTracking } as unknown as TrackingReadClient;
  const getOrder = jest.fn().mockResolvedValue(vendreOrder());
  const vendreClient = { getOrder } as unknown as VendreOrderReadClient;

  return {
    service: new VerifiedTrackingReadService(
      conversationStore,
      verifiedStore,
      trackingClient,
      vendreClient,
    ),
    conversationStore,
    verifiedStore,
    getTracking,
    getOrder,
  };
}

function issueAndBind(
  stores: Pick<ReturnType<typeof build>, 'conversationStore' | 'verifiedStore'>,
  input: {
    conversationId?: string;
    userId?: number;
    orderIds?: string[];
    boundOrderId?: string;
    ttlMs?: number;
  } = {},
) {
  const conversationId = input.conversationId ?? 'conversation_123';
  const userId = input.userId ?? 42;
  const orderIds = input.orderIds ?? ['90250'];
  const boundOrderId = input.boundOrderId ?? orderIds[0];
  const context = stores.verifiedStore.issue(
    {
      method: 'account_assertion',
      subject: `user:${userId}`,
      verifiedOrderIds: orderIds,
      ttlMs: input.ttlMs ?? 20 * 60 * 1000,
    },
    NOW,
  );

  stores.conversationStore.bind(
    {
      conversationId,
      userId,
      orderId: boundOrderId,
      verificationId: context.verificationId,
      expiresAt: FUTURE,
    },
    NOW,
  );

  return context;
}

describe('VerifiedTrackingReadService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('fails closed before any order or tracking read when verification is missing', async () => {
    const { service, getTracking, getOrder } = build();

    await expect(
      service.getTracking({
        conversationId: 'conversation_123',
        userId: 42,
        orderId: '90250',
      }),
    ).resolves.toEqual({ ok: false, error: 'verification_not_found' });
    expect(getOrder).not.toHaveBeenCalled();
    expect(getTracking).not.toHaveBeenCalled();
  });

  it('fails closed when the conversation verification is expired', async () => {
    const { service, conversationStore, verifiedStore, getTracking, getOrder } = build();
    const context = verifiedStore.issue(
      {
        method: 'account_assertion',
        subject: 'user:42',
        verifiedOrderIds: ['90250'],
        ttlMs: 20 * 60 * 1000,
      },
      NOW,
    );
    conversationStore.bind(
      {
        conversationId: 'conversation_123',
        userId: 42,
        orderId: '90250',
        verificationId: context.verificationId,
        expiresAt: '2026-08-14T10:01:00.000Z',
      },
      NOW,
    );

    jest.setSystemTime(new Date('2026-08-14T10:02:00.000Z'));
    await expect(
      service.getTracking({
        conversationId: 'conversation_123',
        userId: 42,
        orderId: '90250',
      }),
    ).resolves.toEqual({ ok: false, error: 'verification_expired' });
    expect(getOrder).not.toHaveBeenCalled();
    expect(getTracking).not.toHaveBeenCalled();
  });

  it('does not allow another authenticated user to reuse the conversation binding', async () => {
    const built = build();
    issueAndBind(built);

    await expect(
      built.service.getTracking({
        conversationId: 'conversation_123',
        userId: 43,
        orderId: '90250',
      }),
    ).resolves.toEqual({ ok: false, error: 'verification_actor_mismatch' });
    expect(built.getOrder).not.toHaveBeenCalled();
    expect(built.getTracking).not.toHaveBeenCalled();
  });

  it('does not allow the binding to be reused for another order', async () => {
    const built = build();
    issueAndBind(built);

    await expect(
      built.service.getTracking({
        conversationId: 'conversation_123',
        userId: 42,
        orderId: '90251',
      }),
    ).resolves.toEqual({ ok: false, error: 'verification_order_mismatch' });
    expect(built.getOrder).not.toHaveBeenCalled();
    expect(built.getTracking).not.toHaveBeenCalled();
  });

  it('does not call fallback tracking when Vendre has a tracking number', async () => {
    const built = build();
    issueAndBind(built);
    built.getOrder.mockResolvedValue(
      vendreOrder({
        trackingNumber: '373325386504796634',
        trackingUrl:
          'https://www.dbschenker.com/app/tracking-public?refNumber=373325386504796634',
        shipmentStatus: 'På väg',
      }),
    );

    await expect(
      built.service.getTracking({
        conversationId: 'conversation_123',
        userId: 42,
        orderId: '90250',
      }),
    ).resolves.toEqual({
      ok: true,
      tracking: {
        orderId: '90250',
        deliveryMethod: null,
        deliveryType: 'other',
        carrier: null,
        shipmentStatus: 'På väg',
        trackingUrl:
          'https://www.dbschenker.com/app/tracking-public?refNumber=373325386504796634',
        parcelNo: '373325386504796634',
        available: true,
        message:
          'Vendre visar spårningsnummer 373325386504796634 för order 90250.',
      },
    });
    expect(built.getOrder).toHaveBeenCalledTimes(1);
    expect(built.getOrder).toHaveBeenCalledWith('90250');
    expect(built.getTracking).not.toHaveBeenCalled();
  });

  it('falls back to the tracking service only after Vendre lacks tracking', async () => {
    const built = build();
    issueAndBind(built);

    await expect(
      built.service.getTracking({
        conversationId: 'conversation_123',
        userId: 42,
        orderId: '90250',
      }),
    ).resolves.toMatchObject({
      ok: true,
      tracking: { orderId: '90250', shipmentStatus: 'In transit' },
    });
    expect(built.getOrder).toHaveBeenCalledTimes(1);
    expect(built.getOrder).toHaveBeenCalledWith('90250');
    expect(built.getTracking).toHaveBeenCalledTimes(1);
    expect(built.getTracking).toHaveBeenCalledWith('90250');
  });

  it('still uses the established fallback when the Vendre tracking read is unavailable', async () => {
    const built = build();
    issueAndBind(built);
    built.getOrder.mockResolvedValue({ ok: false, error: 'order_read_unavailable' });

    await expect(
      built.service.getTracking({
        conversationId: 'conversation_123',
        userId: 42,
        orderId: '90250',
      }),
    ).resolves.toMatchObject({
      ok: true,
      tracking: { parcelNo: '123' },
    });
    expect(built.getOrder).toHaveBeenCalledTimes(1);
    expect(built.getTracking).toHaveBeenCalledTimes(1);
  });
});
