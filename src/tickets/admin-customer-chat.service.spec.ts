import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AdminCustomerChatService } from './admin-customer-chat.service';
import { ChatEventsService } from './chat-events.service';
import { CUSTOMER_CHAT_EVENT_TYPES } from './customer-chat-events';
import {
  CustomerChatConversation,
  CustomerChatConversationStatus,
} from './customer-chat-conversation.entity';
import { CustomerChatInternalNote } from './customer-chat-internal-note.entity';
import {
  CustomerChatMessage,
  CustomerChatMessageRole,
} from './customer-chat-message.entity';

function repo<T>(
  overrides: Partial<Record<keyof Repository<T>, unknown>> = {},
) {
  return overrides as unknown as Repository<T>;
}

function message(
  id: number,
  overrides: Partial<CustomerChatMessage> = {},
): CustomerChatMessage {
  return {
    id,
    role: CustomerChatMessageRole.User,
    content: `message ${id}`,
    escalationRequired: false,
    createdAt: new Date(`2026-01-01T00:00:0${id}.000Z`),
    ...overrides,
  } as CustomerChatMessage;
}

function conversation(
  conversationId: string,
  overrides: Partial<CustomerChatConversation> = {},
): CustomerChatConversation {
  return {
    id: Math.floor(Math.random() * 10000),
    conversationId,
    customer: {
      id: 1,
      name: 'Ada Customer',
      email: 'ada@example.com',
    },
    channel: 'web',
    status: CustomerChatConversationStatus.Escalated,
    lastIntentType: 'frustration',
    lastIntentConfidence: 0.84,
    lastPolicyRoute: 'escalation',
    lastBoundaryType: 'none',
    escalationRequired: true,
    assignedToUserId: null,
    humanHandled: false,
    humanHandledAt: null,
    humanHandledByUserId: null,
    lastHumanReplyAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:10.000Z'),
    messages: [
      message(2, {
        role: CustomerChatMessageRole.Assistant,
        content: 'I can route this to support.',
        intentType: 'frustration',
        intentConfidence: 0.84,
        policyRoute: 'escalation',
        escalationRequired: true,
        policyReasons: ['customer_frustration_detected'],
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
        metadata: { internal: true },
        createdAt: new Date('2026-01-01T00:00:02.000Z'),
      }),
      message(1, {
        content: 'I am angry',
        intentType: 'frustration',
        intentConfidence: 0.84,
        policyRoute: 'escalation',
        escalationRequired: true,
        policyReasons: ['customer_frustration_detected'],
        metadata: { internal: true },
        createdAt: new Date('2026-01-01T00:00:01.000Z'),
      }),
    ],
    ...overrides,
  } as CustomerChatConversation;
}

function createService({
  conversations = [],
  notes = [],
  conversationCountResults = [],
  messageCount = 0,
}: {
  conversations?: CustomerChatConversation[];
  notes?: CustomerChatInternalNote[];
  conversationCountResults?: number[];
  messageCount?: number;
} = {}) {
  const queuedConversationCounts = [...conversationCountResults];
  const conversationRepository = repo<CustomerChatConversation>({
    find: jest.fn(async () => conversations),
    findOne: jest.fn(async ({ where }: { where: { conversationId: string } }) =>
      conversations.find(
        (candidate) => candidate.conversationId === where.conversationId,
      ),
    ),
    count: jest.fn(
      async () => queuedConversationCounts.shift() ?? conversations.length,
    ),
    save: jest.fn(async (value) => value),
  });
  const noteRepository = repo<CustomerChatInternalNote>({
    find: jest.fn(async () => notes),
    create: jest.fn((value) => ({
      id: 21,
      createdAt: new Date('2026-01-01T00:00:03.000Z'),
      ...value,
    })),
    save: jest.fn(async (value) => value),
  });
  const chatMessageRepository = repo<CustomerChatMessage>({
    count: jest.fn(async () => messageCount),
    create: jest.fn((value) => ({
      id: 31,
      createdAt: new Date('2026-01-01T00:00:05.000Z'),
      ...value,
    })),
    save: jest.fn(async (value) => value),
  });
  const chatEvents = {
    publish: jest.fn((event) => event),
    publishMany: jest.fn((events) => events),
  } as unknown as ChatEventsService;

  return {
    service: new AdminCustomerChatService(
      conversationRepository,
      noteRepository,
      chatMessageRepository,
      chatEvents,
    ),
    conversationRepository,
    noteRepository,
    chatMessageRepository,
    chatEvents,
  };
}

describe('AdminCustomerChatService', () => {
  it('returns metrics totals and rates without exposing raw chat metadata', async () => {
    const { service, conversationRepository, chatMessageRepository } =
      createService({
        conversationCountResults: [6, 3, 2, 2, 4],
        messageCount: 14,
      });

    const result = await service.getMetrics();

    expect(result).toEqual({
      totals: {
        conversations: 6,
        messages: 14,
        escalated: 3,
        humanHandled: 2,
        resolved: 2,
        open: 4,
      },
      rates: {
        escalationRate: 0.5,
        humanHandledRate: 0.33,
        resolutionRate: 0.33,
      },
    });
    expect(conversationRepository.count).toHaveBeenCalledTimes(5);
    expect(chatMessageRepository.count).toHaveBeenCalledTimes(1);
    expect(conversationRepository.count).toHaveBeenCalledWith({
      where: [
        { escalationRequired: true },
        { status: CustomerChatConversationStatus.Escalated },
      ],
    });
    expect(conversationRepository.count).toHaveBeenCalledWith({
      where: { humanHandled: true },
    });
    expect(JSON.stringify(result)).not.toContain('policyDecision');
    expect(JSON.stringify(result)).not.toContain('message ');
    expect(JSON.stringify(result)).not.toContain('metadata');
  });

  it('returns zero metrics safely when there are no conversations', async () => {
    const { service } = createService({
      conversationCountResults: [0, 0, 0, 0, 0],
      messageCount: 0,
    });

    await expect(service.getMetrics()).resolves.toEqual({
      totals: {
        conversations: 0,
        messages: 0,
        escalated: 0,
        humanHandled: 0,
        resolved: 0,
        open: 0,
      },
      rates: {
        escalationRate: 0,
        humanHandledRate: 0,
        resolutionRate: 0,
      },
    });
  });

  it('returns quality counts and rates from persisted chat audit fields only', async () => {
    const conversations = [
      conversation('frustration-1', {
        status: CustomerChatConversationStatus.Open,
        lastIntentType: 'frustration',
        lastPolicyRoute: 'escalation',
        lastBoundaryType: 'none',
        messages: [
          message(1, {
            content: 'private frustration text',
            intentType: 'frustration',
            policyReasons: [
              'customer_frustration_detected',
              'repeated_customer_frustration',
            ],
            metadata: { raw: true },
          }),
        ],
      }),
      conversation('off-topic-1', {
        lastIntentType: 'unknown',
        lastPolicyRoute: 'off_topic',
        messages: [],
      }),
      conversation('unsafe-1', {
        lastIntentType: 'unknown',
        lastPolicyRoute: 'guidance',
        lastBoundaryType: 'inappropriate',
        messages: [],
      }),
      conversation('mixed-1', {
        lastIntentType: 'mixed_support_recommendation',
        lastPolicyRoute: 'support',
        messages: [
          message(1, {
            intentType: 'unknown',
            policyReasons: ['mixed_support_recommendation_intent'],
          }),
        ],
      }),
      conversation('recommendation-1', {
        lastIntentType: 'product_recommendation',
        lastPolicyRoute: 'recommendation',
        messages: [],
      }),
      conversation('support-1', {
        lastIntentType: 'support_request',
        lastPolicyRoute: 'support',
        messages: [],
      }),
    ];
    const { service, conversationRepository } = createService({
      conversations,
    });

    const result = await service.getQuality();

    expect(result).toEqual({
      frustration: {
        conversations: 1,
        repeatedFrustration: 1,
        rate: 0.17,
      },
      offTopic: {
        conversations: 1,
        rate: 0.17,
      },
      unsafe: {
        conversations: 1,
        rate: 0.17,
      },
      mixedIntent: {
        conversations: 1,
        rate: 0.17,
      },
      recommendation: {
        conversations: 1,
        rate: 0.17,
      },
      support: {
        conversations: 2,
        rate: 0.33,
      },
    });
    expect(conversationRepository.find).toHaveBeenCalledWith({
      relations: { messages: true },
    });
    expect(JSON.stringify(result)).not.toContain('policyDecision');
    expect(JSON.stringify(result)).not.toContain('private frustration text');
    expect(JSON.stringify(result)).not.toContain('metadata');
  });

  it('returns zero quality safely when there are no conversations', async () => {
    const { service } = createService({ conversations: [] });

    await expect(service.getQuality()).resolves.toEqual({
      frustration: {
        conversations: 0,
        repeatedFrustration: 0,
        rate: 0,
      },
      offTopic: {
        conversations: 0,
        rate: 0,
      },
      unsafe: {
        conversations: 0,
        rate: 0,
      },
      mixedIntent: {
        conversations: 0,
        rate: 0,
      },
      recommendation: {
        conversations: 0,
        rate: 0,
      },
      support: {
        conversations: 0,
        rate: 0,
      },
    });
  });

  it('returns review-worthy inbox rows and excludes resolved by default', async () => {
    const active = conversation('active-1');
    const resolved = conversation('resolved-1', {
      status: CustomerChatConversationStatus.Resolved,
      escalationRequired: false,
      lastIntentType: 'support_request',
      lastPolicyRoute: 'support',
    });
    const { service } = createService({ conversations: [resolved, active] });

    const result = await service.getInbox();

    expect(result.count).toBe(1);
    expect(result.rows[0]).toEqual(
      expect.objectContaining({
        conversationId: 'active-1',
        customerId: 1,
        customerName: 'Ada Customer',
        customerEmail: 'ada@example.com',
        status: CustomerChatConversationStatus.Escalated,
        priority: 'medium',
        lastIntent: 'frustration',
        lastRoute: 'escalation',
        escalationRequired: true,
        escalationReason: 'customer_frustration_detected',
        boundaryType: 'none',
        lastMessagePreview: 'I can route this to support.',
        messageCount: 2,
        assignedTo: null,
        humanHandled: false,
      }),
    );
    expect(result.rows[0]).not.toHaveProperty('metadata');
    expect(result.rows[0]).not.toHaveProperty('policyDecision');
  });

  it('filters inbox by status, escalation, route, intent, assigned user, priority and customer', async () => {
    const matching = conversation('matching-1', {
      assignedToUserId: 7,
      customer: { id: 42, email: 'match@example.com' },
      lastPolicyRoute: 'support',
      lastIntentType: 'mixed_support_recommendation',
      status: CustomerChatConversationStatus.Pending,
    });
    const other = conversation('other-1', {
      assignedToUserId: 8,
      customer: { id: 43, email: 'other@example.com' },
      lastPolicyRoute: 'escalation',
      lastIntentType: 'frustration',
    });
    const { service } = createService({ conversations: [matching, other] });

    const result = await service.getInbox({
      status: CustomerChatConversationStatus.Pending,
      escalationRequired: 'true',
      route: 'support',
      intent: 'mixed_support_recommendation',
      assignedTo: '7',
      priority: 'medium',
      customerId: '42',
    });

    expect(result.rows.map((row) => row.conversationId)).toEqual([
      'matching-1',
    ]);
  });

  it('returns conversation detail with chronological messages and notes', async () => {
    const chat = conversation('detail-1');
    chat.messages.push(
      message(3, {
        role: CustomerChatMessageRole.Human,
        content: 'A human is taking over.',
        policyRoute: 'human_reply',
        escalationRequired: false,
        policyReasons: ['human_reply_sent'],
        createdByUserId: 7,
        metadata: { source: 'human', internal: true },
        createdAt: new Date('2026-01-01T00:00:03.000Z'),
      }),
    );
    const note = {
      id: 99,
      body: 'Customer needs follow-up.',
      authorUserId: 3,
      createdAt: new Date('2026-01-01T00:00:04.000Z'),
    } as CustomerChatInternalNote;
    const { service } = createService({
      conversations: [chat],
      notes: [note],
    });

    const result = await service.getConversationDetail('detail-1');

    expect(result.conversation).toEqual(
      expect.objectContaining({
        conversationId: 'detail-1',
        customerId: 1,
        priority: 'medium',
        assignedTo: null,
        escalationRequired: true,
        reasons: expect.arrayContaining([
          'customer_frustration_detected',
          'human_reply_sent',
        ]),
        integrationStatus: expect.objectContaining({
          support: expect.objectContaining({
            status: 'placeholder',
            capability: 'order_lookup',
            integrationStatus: 'not_configured',
            handled: false,
            requiresHuman: true,
          }),
        }),
        humanHandled: false,
        humanHandledByUserId: null,
      }),
    );
    expect(result.customer).toEqual({
      id: 1,
      name: 'Ada Customer',
      email: 'ada@example.com',
    });
    expect(result.messages.map((item) => item.id)).toEqual([1, 2, 3]);
    expect(result.messages[2]).toEqual(
      expect.objectContaining({
        role: CustomerChatMessageRole.Human,
        content: 'A human is taking over.',
        createdByUserId: 7,
        source: 'human',
        reasons: ['human_reply_sent'],
      }),
    );
    expect(result.messages[0]).not.toHaveProperty('metadata');
    expect(result.messages[0]).not.toHaveProperty('policyDecision');
    expect(result.messages[1].integrations?.support).toEqual(
      expect.objectContaining({
        status: 'placeholder',
        capability: 'order_lookup',
        integrationStatus: 'not_configured',
        requiresHuman: true,
      }),
    );
    expect(result.notes).toEqual([
      {
        id: 99,
        body: 'Customer needs follow-up.',
        authorUserId: 3,
        createdAt: new Date('2026-01-01T00:00:04.000Z'),
      },
    ]);
  });

  it('sends a human reply and marks conversation as human-handled', async () => {
    const chat = conversation('reply-1');
    const {
      service,
      conversationRepository,
      chatMessageRepository,
      chatEvents,
    } = createService({
      conversations: [chat],
    });

    const result = await service.sendHumanReply(
      'reply-1',
      { message: 'We are reviewing this now.' },
      7,
    );

    expect(chatMessageRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation: chat,
        customer: chat.customer,
        role: CustomerChatMessageRole.Human,
        content: 'We are reviewing this now.',
        policyRoute: 'human_reply',
        escalationRequired: false,
        policyReasons: ['human_reply_sent'],
        createdByUserId: 7,
        metadata: {
          source: 'human',
          decisionOwner: 'human_override',
        },
      }),
    );
    expect(conversationRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'reply-1',
        humanHandled: true,
        humanHandledByUserId: 7,
        escalationRequired: false,
        status: CustomerChatConversationStatus.Pending,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        conversationId: 'reply-1',
        status: CustomerChatConversationStatus.Pending,
        escalationRequired: false,
        humanHandled: true,
        humanHandledByUserId: 7,
        message: expect.objectContaining({
          id: 31,
          role: CustomerChatMessageRole.Human,
          content: 'We are reviewing this now.',
          createdByUserId: 7,
          source: 'human',
        }),
      }),
    );
    expect(chatEvents.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: CUSTOMER_CHAT_EVENT_TYPES.HumanReplyCreated,
        conversationId: chat.id,
        customerId: 1,
        messageId: 31,
        actorType: 'admin',
        actorUserId: 7,
        route: 'human_reply',
        status: CustomerChatConversationStatus.Pending,
        previousStatus: CustomerChatConversationStatus.Escalated,
        escalationRequired: false,
        metadata: expect.objectContaining({
          publicConversationId: 'reply-1',
          humanHandled: true,
        }),
      }),
    );
  });

  it('keeps resolved conversation status when a human reply is added', async () => {
    const chat = conversation('reply-resolved-1', {
      status: CustomerChatConversationStatus.Resolved,
      escalationRequired: false,
    });
    const { service } = createService({ conversations: [chat] });

    const result = await service.sendHumanReply(
      'reply-resolved-1',
      { message: 'Final note to customer.' },
      7,
    );

    expect(result.status).toBe(CustomerChatConversationStatus.Resolved);
    expect(result.escalationRequired).toBe(false);
  });

  it('rejects empty human replies', async () => {
    const chat = conversation('reply-empty-1');
    const { service } = createService({ conversations: [chat] });

    await expect(
      service.sendHumanReply('reply-empty-1', { message: ' ' }, 7),
    ).rejects.toThrow(
      'Human reply message must contain at least 2 non-whitespace characters.',
    );
  });

  it('updates assignment metadata', async () => {
    const chat = conversation('assign-1');
    const { service, conversationRepository, chatEvents } = createService({
      conversations: [chat],
    });

    const result = await service.assignConversation('assign-1', {
      assignedToUserId: 12,
    });

    expect(chat.assignedToUserId).toBe(12);
    expect(conversationRepository.save).toHaveBeenCalledWith(chat);
    expect(result).toEqual({
      conversationId: 'assign-1',
      assignedTo: 12,
    });
    expect(chatEvents.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: CUSTOMER_CHAT_EVENT_TYPES.ConversationAssigned,
        conversationId: chat.id,
        customerId: 1,
        actorType: 'admin',
        status: CustomerChatConversationStatus.Escalated,
        escalationRequired: true,
        metadata: expect.objectContaining({
          publicConversationId: 'assign-1',
          assignedToUserId: 12,
          previousAssignedToUserId: null,
        }),
      }),
    );
  });

  it('updates allowed statuses and clears escalation for resolved conversations', async () => {
    const chat = conversation('status-1');
    const { service, chatEvents } = createService({ conversations: [chat] });

    const result = await service.updateConversationStatus('status-1', {
      status: CustomerChatConversationStatus.Resolved,
    });

    expect(result).toEqual({
      conversationId: 'status-1',
      status: CustomerChatConversationStatus.Resolved,
      escalationRequired: false,
    });
    expect(chat.status).toBe(CustomerChatConversationStatus.Resolved);
    expect(chat.escalationRequired).toBe(false);
    expect(chatEvents.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: CUSTOMER_CHAT_EVENT_TYPES.StatusChanged,
        conversationId: chat.id,
        customerId: 1,
        actorType: 'admin',
        status: CustomerChatConversationStatus.Resolved,
        previousStatus: CustomerChatConversationStatus.Escalated,
        escalationRequired: false,
      }),
    );
    expect(chatEvents.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: CUSTOMER_CHAT_EVENT_TYPES.ConversationResolved,
        conversationId: chat.id,
        customerId: 1,
        status: CustomerChatConversationStatus.Resolved,
      }),
    );
  });

  it('rejects invalid statuses', async () => {
    const chat = conversation('status-2');
    const { service } = createService({ conversations: [chat] });

    await expect(
      service.updateConversationStatus('status-2', {
        status: 'random' as CustomerChatConversationStatus,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('computes high priority for unsafe, safety and repeated frustration conversations', async () => {
    const unsafe = conversation('unsafe-1', {
      lastBoundaryType: 'unsafe',
      lastIntentType: 'unsafe_or_inappropriate',
    });
    const safety = conversation('safety-1', {
      lastIntentType: 'safety_concern',
    });
    const repeated = conversation('repeated-1', {
      messages: [
        message(1, {
          policyReasons: [
            'customer_frustration_detected',
            'repeated_customer_frustration',
          ],
        }),
      ],
    });
    const { service } = createService({
      conversations: [unsafe, safety, repeated],
    });

    const result = await service.getInbox();

    expect(result.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          conversationId: 'unsafe-1',
          priority: 'high',
        }),
        expect.objectContaining({
          conversationId: 'safety-1',
          priority: 'high',
        }),
        expect.objectContaining({
          conversationId: 'repeated-1',
          priority: 'high',
        }),
      ]),
    );
  });

  it('adds an internal note without creating fake support integration', async () => {
    const chat = conversation('note-1');
    const { service, noteRepository, chatEvents } = createService({
      conversations: [chat],
    });

    const result = await service.addInternalNote(
      'note-1',
      { body: 'Call customer tomorrow.' },
      5,
    );

    expect(noteRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation: chat,
        authorUserId: 5,
        body: 'Call customer tomorrow.',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 21,
        conversationId: 'note-1',
        body: 'Call customer tomorrow.',
        authorUserId: 5,
      }),
    );
    expect(chatEvents.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: CUSTOMER_CHAT_EVENT_TYPES.InternalNoteCreated,
        conversationId: chat.id,
        customerId: 1,
        actorType: 'admin',
        actorUserId: 5,
        metadata: expect.objectContaining({
          publicConversationId: 'note-1',
          noteId: 21,
        }),
      }),
    );
  });
});
