import { ConversationCustomerVerificationStore } from './conversation-customer-verification.store';

const NOW = new Date('2026-08-13T10:00:00.000Z');
const EXPIRES_AT = '2026-08-13T10:15:00.000Z';
const VERIFICATION_ID = 'vcv_123e4567-e89b-12d3-a456-426614174000';

describe('ConversationCustomerVerificationStore', () => {
  it('binds verification to the exact conversation, authenticated actor and order', () => {
    const store = new ConversationCustomerVerificationStore();
    store.bind({
      conversationId: 'conversation_123',
      userId: 42,
      orderId: '90250',
      verificationId: VERIFICATION_ID,
      expiresAt: EXPIRES_AT,
    });

    expect(store.resolve('conversation_123', 42, '90250', NOW)).toEqual({
      ok: true,
      binding: {
        conversationId: 'conversation_123',
        userId: 42,
        orderId: '90250',
        verificationId: VERIFICATION_ID,
        expiresAt: EXPIRES_AT,
      },
    });
  });

  it('rejects another authenticated actor even with the conversation id', () => {
    const store = new ConversationCustomerVerificationStore();
    store.bind({
      conversationId: 'conversation_123',
      userId: 42,
      orderId: '90250',
      verificationId: VERIFICATION_ID,
      expiresAt: EXPIRES_AT,
    });

    expect(store.resolve('conversation_123', 43, '90250', NOW)).toEqual({
      ok: false,
      error: 'conversation_verification_actor_mismatch',
    });
  });

  it('rejects a different order', () => {
    const store = new ConversationCustomerVerificationStore();
    store.bind({
      conversationId: 'conversation_123',
      userId: 42,
      orderId: '90250',
      verificationId: VERIFICATION_ID,
      expiresAt: EXPIRES_AT,
    });

    expect(store.resolve('conversation_123', 42, '90251', NOW)).toEqual({
      ok: false,
      error: 'conversation_verification_order_mismatch',
    });
  });

  it('removes expired bindings', () => {
    const store = new ConversationCustomerVerificationStore();
    store.bind({
      conversationId: 'conversation_123',
      userId: 42,
      orderId: '90250',
      verificationId: VERIFICATION_ID,
      expiresAt: EXPIRES_AT,
    });

    expect(
      store.resolve(
        'conversation_123',
        42,
        '90250',
        new Date('2026-08-13T10:15:00.000Z'),
      ),
    ).toEqual({ ok: false, error: 'conversation_verification_expired' });
    expect(store.resolve('conversation_123', 42, '90250', NOW)).toEqual({
      ok: false,
      error: 'conversation_verification_not_found',
    });
  });
});
