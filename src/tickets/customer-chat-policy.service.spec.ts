import { CustomerChatPolicyService } from './customer-chat-policy.service';
import { CustomerChatIntent } from './customer-chat.types';

function intent(type: CustomerChatIntent['type']): CustomerChatIntent {
  return {
    type,
    confidence: 0.9,
    source: 'deterministic_rules',
    normalizedMessage: type,
    signals: [],
  };
}

describe('CustomerChatPolicyService', () => {
  const service = new CustomerChatPolicyService();

  it('routes recommendation intent to the existing recommendations endpoint', () => {
    const decision = service.decide(7, intent('product_recommendation'));

    expect(decision.route).toBe('recommendation');
    expect(decision.allowed).toBe(true);
    expect(decision.captureCustomerFacts).toBe(true);
    expect(decision.nextActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'fetch_recommendations',
          status: 'available',
          endpoint: '/customers/7/recommendations',
        }),
      ]),
    );
  });

  it('blocks unsafe or inappropriate requests at the policy boundary', () => {
    const decision = service.decide(7, intent('unsafe_or_inappropriate'));

    expect(decision.route).toBe('boundary');
    expect(decision.allowed).toBe(false);
    expect(decision.captureCustomerFacts).toBe(false);
    expect(decision.boundary.type).toBe('unsafe');
  });

  it('escalates frustration without treating it as a recommendation', () => {
    const decision = service.decide(7, intent('frustration'));

    expect(decision.route).toBe('escalation');
    expect(decision.escalation).toEqual(
      expect.objectContaining({
        required: true,
        priority: 'medium',
      }),
    );
    expect(decision.captureCustomerFacts).toBe(false);
  });

  it('uses a medical boundary for product safety concerns', () => {
    const decision = service.decide(7, intent('safety_concern'));

    expect(decision.route).toBe('escalation');
    expect(decision.boundary.type).toBe('medical');
    expect(decision.escalation.priority).toBe('high');
  });

  it('routes mixed support and recommendation intent to support', () => {
    const decision = service.decide(7, intent('mixed_support_recommendation'));

    expect(decision.route).toBe('support');
    expect(decision.escalation.required).toBe(true);
    expect(decision.reasons).toEqual(
      expect.arrayContaining(['support_takes_priority']),
    );
    expect(decision.nextActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'support_handoff',
          status: 'placeholder',
        }),
      ]),
    );
  });

  it('applies an inappropriate boundary for abusive non-dangerous language', () => {
    const decision = service.decide(7, intent('abusive_language'));

    expect(decision.route).toBe('boundary');
    expect(decision.allowed).toBe(false);
    expect(decision.boundary.type).toBe('inappropriate');
    expect(decision.escalation.required).toBe(false);
  });

  it('raises repeated frustration priority', () => {
    const decision = service.decide(7, intent('frustration'), {
      repeatedFrustration: true,
    });

    expect(decision.escalation.priority).toBe('high');
    expect(decision.reasons).toContain('repeated_customer_frustration');
  });
});
