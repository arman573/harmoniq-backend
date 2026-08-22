import { CustomerChatService } from '../tickets/customer-chat.service';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

describe('CustomersController customer chat contract', () => {
  function createController(chatServiceOverrides: Partial<CustomerChatService>) {
    const customersService = {} as unknown as CustomersService;
    const chatService = chatServiceOverrides as CustomerChatService;

    return {
      controller: new CustomersController(customersService, chatService),
      chatService,
    };
  }

  it('returns stable top-level fields for POST /customers/:id/chat', async () => {
    const chatResult = {
      customerId: 1,
      conversationId: 'conversation-1',
      message: 'I can route this to support.',
      intent: {
        type: 'support_request',
        confidence: 0.82,
        source: 'deterministic_rules',
        normalizedMessage: 'order help',
        signals: ['support'],
      },
      route: 'support',
      policy: {
        route: 'support',
        allowed: true,
        captureCustomerFacts: false,
        reasons: ['support_intent_detected'],
        boundary: { type: 'none' },
        escalation: { required: true, priority: 'low' },
        nextActions: [],
      },
      escalationRequired: true,
      confidence: 0.82,
      reasons: ['support_intent_detected'],
      suggestedActions: [],
      response: {
        text: 'I can route this to support.',
        followUpPrompts: [],
      },
      beautyProfileSummary: {
        domainsDetected: [],
        topConcerns: [],
        topPreferences: [],
        topSensitivities: [],
        confidence: 0,
        confidenceLevel: 'low',
      },
      capturedFactsCount: 0,
      integrations: {
        recommendations: { status: 'not_required' },
        support: {
          status: 'placeholder',
          capability: 'order_lookup',
          integrationStatus: 'not_configured',
          handled: false,
          requiresHuman: true,
        },
      },
      metadata: {
        aiUsed: false,
        decisionOwner: 'backend_policy',
        handledBy: 'harmoniq_customer_core_v1',
        generatedAt: '2026-01-01T00:00:00.000Z',
      },
      audit: {
        userMessageId: 1,
        assistantMessageId: 2,
        boundaryType: 'none',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    };
    const { controller, chatService } = createController({
      handleCustomerChat: jest.fn(async () => chatResult),
    });

    const result = await controller.chat(1, { message: 'Where is my order?' });

    expect(chatService.handleCustomerChat).toHaveBeenCalledWith(1, {
      message: 'Where is my order?',
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
    expect(result.message).toBe(result.response.text);
    expect(result.metadata.aiUsed).toBe(false);
    expect(result.integrations.support).toEqual(
      expect.objectContaining({
        integrationStatus: 'not_configured',
        handled: false,
        requiresHuman: true,
      }),
    );
    expect(result).not.toHaveProperty('recommendations');
    expect(result).not.toHaveProperty('order');
  });

  it('returns customer chat history without internal notes or admin-only metadata', async () => {
    const historyResult = {
      customerId: 1,
      conversations: [
        {
          id: 11,
          customerId: 1,
          conversationId: 'conversation-1',
          channel: 'web',
          status: 'escalated',
          lastIntentType: 'frustration',
          lastIntentConfidence: 0.84,
          lastPolicyRoute: 'escalation',
          boundaryType: 'none',
          escalationRequired: true,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:01:00.000Z'),
          messages: [
            {
              id: 1,
              role: 'user',
              content: 'I am angry',
              intentType: 'frustration',
              intentConfidence: 0.84,
              policyRoute: 'escalation',
              escalationRequired: true,
              reasons: ['customer_frustration_detected'],
              boundaryType: 'none',
              integrations: {
                recommendations: { status: 'not_required' },
                support: { status: 'placeholder' },
              },
              createdAt: new Date('2026-01-01T00:00:01.000Z'),
            },
            {
              id: 2,
              role: 'assistant',
              content: 'I can route this to support.',
              intentType: 'frustration',
              intentConfidence: 0.84,
              policyRoute: 'escalation',
              escalationRequired: true,
              reasons: ['customer_frustration_detected'],
              boundaryType: 'none',
              integrations: {
                recommendations: { status: 'not_required' },
                support: { status: 'placeholder' },
              },
              createdAt: new Date('2026-01-01T00:00:02.000Z'),
            },
          ],
        },
      ],
    };
    const { controller, chatService } = createController({
      getCustomerChatHistory: jest.fn(async () => historyResult),
    });

    const result = await controller.getChatHistory(1);

    expect(chatService.getCustomerChatHistory).toHaveBeenCalledWith(1);
    expect(result.conversations[0].messages.map((message) => message.id)).toEqual([
      1,
      2,
    ]);
    expect(result.conversations[0]).not.toHaveProperty('notes');
    expect(result.conversations[0].messages[0]).not.toHaveProperty('metadata');
    expect(result.conversations[0].messages[0]).not.toHaveProperty(
      'policyDecision',
    );
    expect(result.conversations[0].messages[0]).not.toHaveProperty(
      'createdByUserId',
    );
  });
});
