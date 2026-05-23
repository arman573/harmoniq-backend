import { CustomerChatIntentService } from './customer-chat-intent.service';

describe('CustomerChatIntentService', () => {
  const service = new CustomerChatIntentService();

  it('detects product recommendation intent', () => {
    const intent = service.understand(
      'Can you recommend a product for my dry skin?',
    );

    expect(intent).toEqual(
      expect.objectContaining({
        type: 'product_recommendation',
        source: 'deterministic_rules',
      }),
    );
    expect(intent.confidence).toBeGreaterThan(0.8);
  });

  it('keeps off-topic recommendation requests out of the product route', () => {
    const intent = service.understand('Give me a movie recommendation');

    expect(intent.type).toBe('off_topic');
  });

  it('detects product safety concerns', () => {
    const intent = service.understand(
      'I have swelling and hives after using this serum',
    );

    expect(intent.type).toBe('safety_concern');
    expect(intent.signals).toContain('escalation');
  });

  it('detects beauty profile updates without routing to recommendations', () => {
    const intent = service.understand(
      'I have dry hair and prefer sulfate free shampoo',
    );

    expect(intent.type).toBe('profile_update');
  });

  it('detects mixed support and recommendation intent', () => {
    const intent = service.understand(
      'I need a refund and can you recommend something else?',
    );

    expect(intent.type).toBe('mixed_support_recommendation');
    expect(intent.signals).toEqual(
      expect.arrayContaining(['support', 'recommendation', 'mixed_intent']),
    );
  });

  it('detects abusive but non-dangerous language separately from unsafe intent', () => {
    const intent = service.understand('You are useless and stupid');

    expect(intent.type).toBe('abusive_language');
    expect(intent.signals).toContain('abusive_language');
  });
});
