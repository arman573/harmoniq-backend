import { ChatEventsService } from './chat-events.service';
import { ChatNotificationHooksService } from './chat-notification-hooks.service';
import { CUSTOMER_CHAT_EVENT_TYPES } from './customer-chat-events';

describe('ChatEventsService', () => {
  it('publishes safe customer chat events without raw policy or intent metadata', () => {
    const hooks = new ChatNotificationHooksService();
    const escalatedSpy = jest.spyOn(hooks, 'onConversationEscalated');
    const service = new ChatEventsService(hooks);

    const event = service.publish({
      eventType: CUSTOMER_CHAT_EVENT_TYPES.ConversationEscalated,
      conversationId: 11,
      customerId: 1,
      actorType: 'system',
      intent: 'frustration',
      route: 'escalation',
      status: 'escalated',
      escalationRequired: true,
      priority: 'medium',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {
        publicConversationId: 'conversation-1',
        reasonCodes: ['customer_frustration_detected'],
        policyDecision: { route: 'escalation' },
        rawIntent: { normalizedMessage: 'internal text' },
        metadata: { internal: true },
      },
    });

    expect(event.metadata).toEqual({
      publicConversationId: 'conversation-1',
      reasonCodes: ['customer_frustration_detected'],
    });
    expect(JSON.stringify(event)).not.toContain('policyDecision');
    expect(JSON.stringify(event)).not.toContain('rawIntent');
    expect(escalatedSpy).toHaveBeenCalledWith(event);
  });

  it('keeps notification hooks as no-op placeholders', () => {
    const hooks = new ChatNotificationHooksService();
    const event = {
      eventType: CUSTOMER_CHAT_EVENT_TYPES.HumanReplyCreated,
      conversationId: 11,
      customerId: 1,
      actorType: 'admin' as const,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    expect(hooks.onHumanReplyCreated(event)).toBeUndefined();
    expect(hooks.onConversationAssigned(event)).toBeUndefined();
    expect(hooks.onStatusChanged(event)).toBeUndefined();
    expect(hooks.onConversationResolved(event)).toBeUndefined();
  });
});
