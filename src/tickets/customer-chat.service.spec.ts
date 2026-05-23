import { Repository } from 'typeorm';
import { ChatEventsService } from './chat-events.service';
import { Customer } from './customer.entity';
import { CUSTOMER_CHAT_EVENT_TYPES } from './customer-chat-events';
import {
  CustomerChatConversation,
  CustomerChatConversationStatus,
} from './customer-chat-conversation.entity';
import { CustomerChatIntentService } from './customer-chat-intent.service';
import {
  CustomerChatMessage,
  CustomerChatMessageRole,
} from './customer-chat-message.entity';
import { CustomerChatPolicyService } from './customer-chat-policy.service';
import { CustomerChatResponseComposerService } from './customer-chat-response-composer.service';
import { CustomerChatService } from './customer-chat.service';
import { CustomerFact } from './customer-fact.entity';
import { CustomerIntelligenceService } from './customer-intelligence.service';
import { SupportIntegrationService } from './support-integration.service';

function repo<T>(
  overrides: Partial<Record<keyof Repository<T>, unknown>> = {},
) {
  return overrides as unknown as Repository<T>;
}

function fact(value: string, overrides: Partial<CustomerFact> = {}) {
  return {
    id: Math.random(),
    type: 'skin_concern',
    value,
    confidence: 0.8,
    source: 'test',
    ...overrides,
  } as CustomerFact;
}

function createService({
  existingFacts = [],
  extractedFacts = [],
  customer = { id: 1, email: 'customer@example.com' } as Customer,
  existingConversation = null,
  historyConversations = [],
  priorFrustrationCount = 0,
}: {
  existingFacts?: CustomerFact[];
  extractedFacts?: CustomerFact[];
  customer?: Customer | null;
  existingConversation?: CustomerChatConversation | null;
  historyConversations?: CustomerChatConversation[];
  priorFrustrationCount?: number;
} = {}) {
  const savedMessages: CustomerChatMessage[] = [];
  const intelligenceService = {
    extractFactsFromMessage: jest.fn(async () => extractedFacts),
    createEvent: jest.fn(async () => undefined),
  } as unknown as CustomerIntelligenceService;
  const publish = jest.fn((event) => event);
  const chatEvents = {
    publish,
    publishMany: jest.fn((events) => events.map((event) => publish(event))),
  } as unknown as ChatEventsService;
  const conversationRepository = repo<CustomerChatConversation>({
    findOne: jest.fn(async () => existingConversation),
    find: jest.fn(async () => historyConversations),
    create: jest.fn((value) => ({
      id: 11,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      messages: [],
      ...value,
    })),
    save: jest.fn(async (value) => ({
      id: 11,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      ...value,
    })),
  });
  const chatMessageRepository = repo<CustomerChatMessage>({
    count: jest.fn(async () => priorFrustrationCount),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => {
      const messages = Array.isArray(value) ? value : [value];

      const persisted = messages.map((message, index) => ({
        id: savedMessages.length + index + 1,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        ...message,
      }));

      savedMessages.push(...persisted);

      return persisted;
    }),
  });
  const service = new CustomerChatService(
    repo<Customer>({
      findOne: jest.fn(async () => customer),
    }),
    repo<CustomerFact>({
      find: jest.fn(async () => existingFacts),
    }),
    conversationRepository,
    chatMessageRepository,
    new CustomerChatIntentService(),
    new CustomerChatPolicyService(),
    new CustomerChatResponseComposerService(),
    chatEvents,
    new SupportIntegrationService(),
    intelligenceService,
  );

  return {
    service,
    intelligenceService,
    conversationRepository,
    chatMessageRepository,
    chatEvents,
    savedMessages,
  };
}

describe('CustomerChatService', () => {
  it('routes recommendation chat to the existing recommendation integration', async () => {
    const {
      service,
      intelligenceService,
      conversationRepository,
      chatMessageRepository,
      chatEvents,
      savedMessages,
    } = createService({
      extractedFacts: [fact('dry_skin')],
    });

    const result = await service.handleCustomerChat(1, {
      message: 'Can you recommend a product for my dry skin?',
      conversationId: 'conversation-1',
      channel: 'web',
    });

    expect(Object.keys(result).sort()).toEqual(
      [
        'audit',
        'beautyProfileSummary',
        'capturedFactsCount',
        'confidence',
        'conversationId',
        'customerId',
        'escalationRequired',
        'integrations',
        'intent',
        'message',
        'metadata',
        'policy',
        'reasons',
        'response',
        'route',
        'suggestedActions',
      ].sort(),
    );
    expect(result.intent.type).toBe('product_recommendation');
    expect(result.message).toBe(result.response.text);
    expect(result.route).toBe('recommendation');
    expect(result.policy.route).toBe('recommendation');
    expect(result.escalationRequired).toBe(false);
    expect(result.confidence).toBe(0.82);
    expect(result.reasons).toEqual(['recommendation_intent_detected']);
    expect(result.suggestedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'fetch_recommendations' }),
      ]),
    );
    expect(result.metadata.aiUsed).toBe(false);
    expect(result.audit).toEqual(
      expect.objectContaining({
        userMessageId: 1,
        assistantMessageId: 2,
        boundaryType: 'none',
      }),
    );
    expect(result.integrations.recommendations).toEqual(
      expect.objectContaining({
        status: 'available',
        endpoint: '/customers/1/recommendations',
      }),
    );
    expect(result).not.toHaveProperty('recommendations');
    expect(result.capturedFactsCount).toBe(1);
    expect(result.beautyProfileSummary.domainsDetected).toEqual(['skin']);
    expect(result.response.text).toContain('Backend scoring');
    expect(conversationRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conversation-1',
        channel: 'web',
      }),
    );
    expect(chatMessageRepository.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: CustomerChatMessageRole.User,
          content: 'Can you recommend a product for my dry skin?',
          intentType: 'product_recommendation',
          intentConfidence: 0.82,
          policyRoute: 'recommendation',
          escalationRequired: false,
          boundaryType: 'none',
          policyReasons: ['recommendation_intent_detected'],
          policyDecision: expect.objectContaining({
            route: 'recommendation',
          }),
          integrations: expect.objectContaining({
            recommendations: expect.objectContaining({
              status: 'available',
            }),
          }),
        }),
        expect.objectContaining({
          role: CustomerChatMessageRole.Assistant,
          content: expect.stringContaining('Backend scoring'),
          intentType: 'product_recommendation',
          policyRoute: 'recommendation',
        }),
      ]),
    );
    expect(savedMessages).toHaveLength(2);
    expect(chatEvents.publishMany).toHaveBeenCalledWith([
      expect.objectContaining({
        eventType: CUSTOMER_CHAT_EVENT_TYPES.CustomerMessageCreated,
        conversationId: 11,
        customerId: 1,
        messageId: 1,
        actorType: 'customer',
        intent: 'product_recommendation',
        route: 'recommendation',
        escalationRequired: false,
      }),
      expect.objectContaining({
        eventType: CUSTOMER_CHAT_EVENT_TYPES.AssistantResponseCreated,
        conversationId: 11,
        customerId: 1,
        messageId: 2,
        actorType: 'assistant',
        intent: 'product_recommendation',
        route: 'recommendation',
      }),
    ]);
    expect(chatEvents.publish).toHaveBeenCalledTimes(2);
    expect(intelligenceService.extractFactsFromMessage).toHaveBeenCalledTimes(
      1,
    );
    expect(intelligenceService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          conversationId: 'conversation-1',
          intentType: 'product_recommendation',
          route: 'recommendation',
          aiUsed: false,
        }),
      }),
    );
  });

  it('handles off-topic chat without extracting facts', async () => {
    const { service, intelligenceService, savedMessages } = createService();

    const result = await service.handleCustomerChat(1, {
      message: 'What is the weather today?',
    });

    expect(result.intent.type).toBe('off_topic');
    expect(result.policy.route).toBe('off_topic');
    expect(result.policy.allowed).toBe(false);
    expect(result.integrations.recommendations.status).toBe('not_required');
    expect(result.response.text).toContain('HARMONIQ beauty products');
    expect(result.response.text).not.toContain('sunny');
    expect(savedMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: CustomerChatMessageRole.User,
          intentType: 'off_topic',
          policyRoute: 'off_topic',
          escalationRequired: false,
          policyReasons: ['off_topic_for_customer_core'],
        }),
      ]),
    );
    expect(intelligenceService.extractFactsFromMessage).not.toHaveBeenCalled();
  });

  it('escalates frustrated customers to support placeholders', async () => {
    const { service, chatEvents, savedMessages } = createService();

    const result = await service.handleCustomerChat(1, {
      message: 'I am angry and this is not acceptable',
    });

    expect(result.intent.type).toBe('frustration');
    expect(result.policy.escalation).toEqual(
      expect.objectContaining({
        required: true,
        priority: 'medium',
      }),
    );
    expect(result.integrations.support).toEqual(
      expect.objectContaining({
        status: 'placeholder',
        capability: 'human_support_handoff',
        integrationStatus: 'not_configured',
        handled: false,
        requiresHuman: true,
        missingFields: [],
        safeCustomerMessage: expect.stringContaining('not connected yet'),
      }),
    );
    expect(savedMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: CustomerChatMessageRole.User,
          intentType: 'frustration',
          policyRoute: 'escalation',
          escalationRequired: true,
          policyReasons: ['customer_frustration_detected'],
          integrations: expect.objectContaining({
            support: expect.objectContaining({
              capability: 'human_support_handoff',
              integrationStatus: 'not_configured',
              requiresHuman: true,
            }),
          }),
        }),
      ]),
    );
    expect(chatEvents.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: CUSTOMER_CHAT_EVENT_TYPES.ConversationEscalated,
        conversationId: 11,
        customerId: 1,
        actorType: 'system',
        intent: 'frustration',
        route: 'escalation',
        escalationRequired: true,
        priority: 'medium',
      }),
    );
  });

  it('escalates repeated frustration with high priority', async () => {
    const { service } = createService({ priorFrustrationCount: 2 });

    const result = await service.handleCustomerChat(1, {
      message: 'I am frustrated and upset',
      conversationId: 'existing-conversation',
    });

    expect(result.policy.escalation).toEqual(
      expect.objectContaining({
        required: true,
        priority: 'high',
      }),
    );
    expect(result.reasons).toEqual(
      expect.arrayContaining(['repeated_customer_frustration']),
    );
  });

  it('applies a medical boundary for product safety concerns', async () => {
    const { service, savedMessages } = createService();

    const result = await service.handleCustomerChat(1, {
      message: 'This cream caused swelling and hives',
    });

    expect(result.intent.type).toBe('safety_concern');
    expect(result.policy.boundary.type).toBe('medical');
    expect(result.policy.escalation.priority).toBe('high');
    expect(result.audit.boundaryType).toBe('medical');
    expect(result.response.text).toContain('cannot diagnose');
    expect(savedMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          intentType: 'safety_concern',
          policyRoute: 'escalation',
          escalationRequired: true,
          boundaryType: 'medical',
          policyReasons: ['product_safety_or_medical_boundary'],
        }),
      ]),
    );
  });

  it('persists unsafe boundary audit metadata without normal support routing', async () => {
    const { service, savedMessages } = createService();

    const result = await service.handleCustomerChat(1, {
      message: 'I want to harm someone',
    });

    expect(result.intent.type).toBe('unsafe_or_inappropriate');
    expect(result.route).toBe('boundary');
    expect(result.policy.allowed).toBe(false);
    expect(result.escalationRequired).toBe(false);
    expect(result.audit.boundaryType).toBe('unsafe');
    expect(savedMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          intentType: 'unsafe_or_inappropriate',
          policyRoute: 'boundary',
          boundaryType: 'unsafe',
          policyReasons: ['unsafe_or_inappropriate_boundary'],
        }),
      ]),
    );
  });

  it('routes mixed support and recommendation intent to support first', async () => {
    const { service } = createService();

    const result = await service.handleCustomerChat(1, {
      message: 'I need a refund and also recommend a product',
    });

    expect(result.intent.type).toBe('mixed_support_recommendation');
    expect(result.route).toBe('support');
    expect(result.escalationRequired).toBe(true);
    expect(result.reasons).toEqual(
      expect.arrayContaining(['support_takes_priority']),
    );
    expect(result.integrations.support).toEqual(
      expect.objectContaining({
        status: 'placeholder',
        capability: 'return_request',
        integrationStatus: 'not_configured',
        handled: false,
        requiresHuman: true,
      }),
    );
    expect(result.integrations.recommendations.status).toBe('not_required');
    expect(result).not.toHaveProperty('recommendations');
  });

  it('rejects empty or too-short messages deterministically', async () => {
    const { service } = createService();

    await expect(
      service.handleCustomerChat(1, { message: ' ' }),
    ).rejects.toThrow(
      'Customer chat message must contain at least 2 non-whitespace characters.',
    );
  });

  it('throws when the customer does not exist', async () => {
    const { service } = createService({ customer: null });

    await expect(
      service.handleCustomerChat(99, { message: 'hello' }),
    ).rejects.toThrow('Customer 99 not found');
  });

  it('returns persisted chat history for a customer', async () => {
    const conversation = {
      id: 11,
      conversationId: 'conversation-1',
      channel: 'web',
      status: CustomerChatConversationStatus.Escalated,
      lastIntentType: 'frustration',
      lastIntentConfidence: 0.84,
      lastPolicyRoute: 'escalation',
      lastBoundaryType: 'none',
      escalationRequired: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:01:00.000Z'),
      messages: [
        {
          id: 2,
          role: CustomerChatMessageRole.Assistant,
          content: 'I can route this to support.',
          intentType: 'frustration',
          intentConfidence: 0.84,
          policyRoute: 'escalation',
          escalationRequired: true,
          policyReasons: ['customer_frustration_detected'],
          boundaryType: 'none',
          integrations: {
            recommendations: { status: 'not_required' },
            support: { status: 'placeholder' },
          },
          intent: { type: 'frustration' },
          policyDecision: { route: 'escalation' },
          metadata: { internal: true },
          createdAt: new Date('2026-01-01T00:00:02.000Z'),
        },
        {
          id: 1,
          role: CustomerChatMessageRole.User,
          content: 'I am angry',
          intentType: 'frustration',
          intentConfidence: 0.84,
          policyRoute: 'escalation',
          escalationRequired: true,
          policyReasons: ['customer_frustration_detected'],
          boundaryType: 'none',
          intent: { type: 'frustration' },
          policyDecision: { route: 'escalation' },
          metadata: { internal: true },
          createdAt: new Date('2026-01-01T00:00:01.000Z'),
        },
        {
          id: 3,
          role: CustomerChatMessageRole.Human,
          content: 'A human has replied.',
          policyRoute: 'human_reply',
          escalationRequired: false,
          policyReasons: ['human_reply_sent'],
          boundaryType: 'none',
          metadata: { source: 'human', internal: true },
          createdByUserId: 7,
          createdAt: new Date('2026-01-01T00:00:03.000Z'),
        },
      ],
    } as CustomerChatConversation;
    const { service } = createService({
      historyConversations: [conversation],
    });

    const result = await service.getCustomerChatHistory(1);

    expect(result).toEqual(
      expect.objectContaining({
        customerId: 1,
        conversations: [
          expect.objectContaining({
            customerId: 1,
            conversationId: 'conversation-1',
            status: CustomerChatConversationStatus.Escalated,
            escalationRequired: true,
            lastIntentType: 'frustration',
            lastIntentConfidence: 0.84,
            lastPolicyRoute: 'escalation',
            boundaryType: 'none',
          }),
        ],
      }),
    );
    expect(
      result.conversations[0].messages.map((message) => message.id),
    ).toEqual([1, 2, 3]);
    expect(result.conversations[0].messages[0]).toEqual(
      expect.objectContaining({
        role: CustomerChatMessageRole.User,
        intentType: 'frustration',
        policyRoute: 'escalation',
        reasons: ['customer_frustration_detected'],
        boundaryType: 'none',
      }),
    );
    expect(result.conversations[0].messages[0]).not.toHaveProperty('intent');
    expect(result.conversations[0].messages[0]).not.toHaveProperty(
      'policyDecision',
    );
    expect(result.conversations[0].messages[0]).not.toHaveProperty('metadata');
    expect(result.conversations[0]).not.toHaveProperty('notes');
    expect(result.conversations[0].messages[2]).toEqual(
      expect.objectContaining({
        role: CustomerChatMessageRole.Human,
        content: 'A human has replied.',
        policyRoute: 'human_reply',
        reasons: ['human_reply_sent'],
      }),
    );
    expect(result.conversations[0].messages[2]).not.toHaveProperty(
      'createdByUserId',
    );
    expect(result.conversations[0].messages[2]).not.toHaveProperty('metadata');
  });
});
