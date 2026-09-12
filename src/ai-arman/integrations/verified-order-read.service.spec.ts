import type { ConversationCustomerVerificationStore } from '../identity/conversation-customer-verification.store';
import type { VerifiedCustomerContextStore } from '../identity/verified-customer-context.store';
import type { VendreOrderReadClient } from './vendre-order-read.client';
import { VerifiedOrderReadService } from './verified-order-read.service';

function build(bindingResult: unknown, contextResult: unknown) {
  const conversationStore = {
    resolve: jest.fn().mockReturnValue(bindingResult),
  } as unknown as ConversationCustomerVerificationStore;
  const verifiedStore = {
    resolve: jest.fn().mockReturnValue(contextResult),
  } as unknown as VerifiedCustomerContextStore;
  const getOrder = jest.fn().mockResolvedValue({
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
  const client = { getOrder } as unknown as VendreOrderReadClient;

  return {
    service: new VerifiedOrderReadService(
      conversationStore,
      verifiedStore,
      client,
    ),
    verifiedStore,
    getOrder,
  };
}

describe('VerifiedOrderReadService', () => {
  it('stops before Vendre when conversation verification is missing', async () => {
    const { service, getOrder } = build(
      { ok: false, error: 'conversation_verification_not_found' },
      { ok: false, error: 'verification_not_found' },
    );

    await expect(
      service.getOrder({
        conversationId: 'conversation_123',
        userId: 42,
        orderId: '90250',
      }),
    ).resolves.toEqual({ ok: false, error: 'verification_not_found' });
    expect(getOrder).not.toHaveBeenCalled();
  });

  it('stops before Vendre when the authenticated actor does not match', async () => {
    const { service, getOrder } = build(
      { ok: false, error: 'conversation_verification_actor_mismatch' },
      { ok: false, error: 'verification_not_found' },
    );

    await expect(
      service.getOrder({
        conversationId: 'conversation_123',
        userId: 43,
        orderId: '90250',
      }),
    ).resolves.toEqual({ ok: false, error: 'verification_actor_mismatch' });
    expect(getOrder).not.toHaveBeenCalled();
  });

  it('stops before Vendre when the order binding does not match', async () => {
    const { service, getOrder } = build(
      { ok: false, error: 'conversation_verification_order_mismatch' },
      { ok: false, error: 'verification_not_found' },
    );

    await expect(
      service.getOrder({
        conversationId: 'conversation_123',
        userId: 42,
        orderId: '90251',
      }),
    ).resolves.toEqual({ ok: false, error: 'verification_order_mismatch' });
    expect(getOrder).not.toHaveBeenCalled();
  });

  it('reads exactly one order after both verification layers pass', async () => {
    const { service, getOrder } = build(
      {
        ok: true,
        binding: {
          verificationId: 'opaque-verification',
          conversationId: 'conversation_123',
          userId: 42,
          orderId: '90250',
          expiresAt: 'future',
        },
      },
      { ok: true, context: { verifiedOrderIds: ['90250'] } },
    );

    await expect(
      service.getOrder({
        conversationId: 'conversation_123',
        userId: 42,
        orderId: '90250',
      }),
    ).resolves.toMatchObject({
      ok: true,
      order: { orderId: '90250', status: 'Skickad' },
    });
    expect(getOrder).toHaveBeenCalledTimes(1);
    expect(getOrder).toHaveBeenCalledWith('90250');
  });
});
