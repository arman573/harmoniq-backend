import { ConversationCustomerVerificationStore } from '../identity/conversation-customer-verification.store';
import { VerifiedCustomerContextStore } from '../identity/verified-customer-context.store';
import type { TrackingReadClient } from './tracking-read.client';
import { VerifiedTrackingReadService } from './verified-tracking-read.service';

const NOW = new Date('2026-08-14T10:00:00.000Z');
const FUTURE = '2026-08-14T10:20:00.000Z';

function build() {
  const conversationStore = new ConversationCustomerVerificationStore();
  const verifiedStore = new VerifiedCustomerContextStore();
  const getTracking = jest.fn().mockResolvedValue({
    ok: true,
    tracking: {
      orderId: '90250',
      deliveryMethod: 'DB Schenker',
      deliveryType: 'schenker',
      carrier: 'DB Schenker',
      shipmentStatus: 'In transit',
      trackingUrl: 'https://tracking.example.test/parcel/123',
      parcelNo: '123',
      available: true,
      message: null,
    },
  });
  const client = { getTracking } as unknown as TrackingReadClient;

  return {
    service: new VerifiedTrackingReadService(
      conversationStore,
      verifiedStore,
      client,
    ),
    conversationStore,
    verifiedStore,
    getTracking,
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
  it('fails closed before tracking read when verification is missing', async () => {
    const { service, getTracking } = build();

    await expect(
      service.getTracking({
        conversationId: 'conversation_123',
        userId: 42,
        orderId: '90250',
      }),
    ).resolves.toEqual({ ok: false, error: 'verification_not_found' });
    expect(getTracking).not.toHaveBeenCalled();
  });

  it('fails closed when the conversation verification is expired', async () => {
    const { service, conversationStore, verifiedStore, getTracking } = build();
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

    jest.useFakeTimers().setSystemTime(new Date('2026-08-14T10:02:00.000Z'));
    await expect(
      service.getTracking({
        conversationId: 'conversation_123',
        userId: 42,
        orderId: '90250',
      }),
    ).resolves.toEqual({ ok: false, error: 'verification_expired' });
    expect(getTracking).not.toHaveBeenCalled();
    jest.useRealTimers();
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
    expect(built.getTracking).not.toHaveBeenCalled();
  });

  it('fails closed when the verified customer context does not include the bound order', async () => {
    const built = build();
    const context = built.verifiedStore.issue(
      {
        method: 'account_assertion',
        subject: 'user:42',
        verifiedOrderIds: ['90251'],
      },
      NOW,
    );
    built.conversationStore.bind(
      {
        conversationId: 'conversation_123',
        userId: 42,
        orderId: '90250',
        verificationId: context.verificationId,
        expiresAt: FUTURE,
      },
      NOW,
    );

    await expect(
      built.service.getTracking({
        conversationId: 'conversation_123',
        userId: 42,
        orderId: '90250',
      }),
    ).resolves.toEqual({ ok: false, error: 'verification_order_mismatch' });
    expect(built.getTracking).not.toHaveBeenCalled();
  });

  it('reads tracking exactly once after both verification layers pass', async () => {
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
    expect(built.getTracking).toHaveBeenCalledTimes(1);
    expect(built.getTracking).toHaveBeenCalledWith('90250');
  });
});
