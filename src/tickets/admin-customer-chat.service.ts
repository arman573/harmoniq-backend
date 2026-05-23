import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  AdminChatPriority,
  AdminCustomerChatInboxQueryDto,
  AssignCustomerChatConversationDto,
  CreateCustomerChatHumanReplyDto,
  CreateCustomerChatInternalNoteDto,
  UpdateCustomerChatConversationStatusDto,
} from './admin-customer-chat.dto';
import { ChatEventsService } from './chat-events.service';
import {
  CUSTOMER_CHAT_EVENT_TYPES,
  CustomerChatEventPayload,
} from './customer-chat-events';
import {
  CustomerChatConversation,
  CustomerChatConversationStatus,
} from './customer-chat-conversation.entity';
import { CustomerChatInternalNote } from './customer-chat-internal-note.entity';
import {
  CustomerChatMessage,
  CustomerChatMessageRole,
} from './customer-chat-message.entity';

type AdminChatInboxRow = {
  conversationId: string;
  customerId: number;
  customerName?: string;
  customerEmail?: string;
  status: CustomerChatConversationStatus;
  priority: AdminChatPriority;
  lastIntent?: string;
  lastRoute?: string;
  escalationRequired: boolean;
  escalationReason?: string;
  reasons: string[];
  boundaryType: string;
  lastMessagePreview: string;
  lastMessageAt?: Date;
  messageCount: number;
  assignedTo: number | null;
  humanHandled: boolean;
  humanHandledAt?: Date | null;
  humanHandledByUserId?: number | null;
  lastHumanReplyAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class AdminCustomerChatService {
  constructor(
    @InjectRepository(CustomerChatConversation)
    private readonly conversationRepository: Repository<CustomerChatConversation>,
    @InjectRepository(CustomerChatInternalNote)
    private readonly noteRepository: Repository<CustomerChatInternalNote>,
    @InjectRepository(CustomerChatMessage)
    private readonly chatMessageRepository: Repository<CustomerChatMessage>,
    private readonly chatEvents: ChatEventsService,
  ) {}

  async getInbox(query: AdminCustomerChatInboxQueryDto = {}) {
    const conversations = await this.conversationRepository.find({
      relations: { customer: true, messages: true },
      order: { updatedAt: 'DESC' },
    });

    const rows = conversations
      .map((conversation) => this.toInboxRow(conversation))
      .filter((row) => this.isReviewWorthy(row, query))
      .filter((row) => this.matchesFilters(row, query))
      .sort((a, b) => {
        const priorityDiff =
          getPriorityRank(b.priority) - getPriorityRank(a.priority);
        if (priorityDiff) return priorityDiff;

        return getTimestamp(b.lastMessageAt) - getTimestamp(a.lastMessageAt);
      });

    return {
      rows,
      count: rows.length,
    };
  }

  async getMetrics() {
    const [conversations, messages, escalated, humanHandled, resolved, open] =
      await Promise.all([
        this.conversationRepository.count(),
        this.chatMessageRepository.count(),
        this.conversationRepository.count({
          where: [
            { escalationRequired: true },
            { status: CustomerChatConversationStatus.Escalated },
          ],
        }),
        this.conversationRepository.count({ where: { humanHandled: true } }),
        this.conversationRepository.count({
          where: {
            status: In([
              CustomerChatConversationStatus.Resolved,
              CustomerChatConversationStatus.Closed,
            ]),
          },
        }),
        this.conversationRepository.count({
          where: {
            status: In([
              CustomerChatConversationStatus.Open,
              CustomerChatConversationStatus.Pending,
              CustomerChatConversationStatus.Escalated,
            ]),
          },
        }),
      ]);

    return {
      totals: {
        conversations,
        messages,
        escalated,
        humanHandled,
        resolved,
        open,
      },
      rates: {
        escalationRate: rate(escalated, conversations),
        humanHandledRate: rate(humanHandled, conversations),
        resolutionRate: rate(resolved, conversations),
      },
    };
  }

  async getQuality() {
    const conversations = await this.conversationRepository.find({
      relations: { messages: true },
    });
    const total = conversations.length;
    const frustration = conversations.filter((conversation) =>
      hasFrustrationSignal(conversation),
    ).length;
    const repeatedFrustration = conversations.filter((conversation) =>
      hasReasonSignal(conversation, 'repeated_customer_frustration'),
    ).length;
    const offTopic = conversations.filter((conversation) =>
      hasOffTopicSignal(conversation),
    ).length;
    const unsafe = conversations.filter((conversation) =>
      hasUnsafeSignal(conversation),
    ).length;
    const mixedIntent = conversations.filter((conversation) =>
      hasMixedIntentSignal(conversation),
    ).length;
    const recommendation = conversations.filter((conversation) =>
      hasRecommendationSignal(conversation),
    ).length;
    const support = conversations.filter((conversation) =>
      hasSupportSignal(conversation),
    ).length;

    return {
      frustration: {
        conversations: frustration,
        repeatedFrustration,
        rate: rate(frustration, total),
      },
      offTopic: {
        conversations: offTopic,
        rate: rate(offTopic, total),
      },
      unsafe: {
        conversations: unsafe,
        rate: rate(unsafe, total),
      },
      mixedIntent: {
        conversations: mixedIntent,
        rate: rate(mixedIntent, total),
      },
      recommendation: {
        conversations: recommendation,
        rate: rate(recommendation, total),
      },
      support: {
        conversations: support,
        rate: rate(support, total),
      },
    };
  }

  async getConversationDetail(conversationId: string) {
    const conversation = await this.findConversationOrThrow(conversationId);
    const notes = await this.noteRepository.find({
      where: { conversation: { id: conversation.id } },
      order: { createdAt: 'ASC' },
    });
    const row = this.toInboxRow(conversation);

    return {
      conversation: {
        conversationId: conversation.conversationId,
        customerId: conversation.customer.id,
        status: conversation.status,
        priority: row.priority,
        assignedTo: conversation.assignedToUserId ?? null,
        lastIntent: conversation.lastIntentType,
        lastIntentConfidence: conversation.lastIntentConfidence,
        lastRoute: conversation.lastPolicyRoute,
        escalationRequired: conversation.escalationRequired,
        escalationReason: row.escalationReason,
        reasons: row.reasons,
        boundaryType: row.boundaryType,
        integrationStatus: rowIntegrationStatus(conversation.messages || []),
        humanHandled: conversation.humanHandled,
        humanHandledAt: conversation.humanHandledAt,
        humanHandledByUserId: conversation.humanHandledByUserId ?? null,
        lastHumanReplyAt: conversation.lastHumanReplyAt,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
      customer: {
        id: conversation.customer.id,
        name: conversation.customer.name,
        email: conversation.customer.email,
      },
      messages: this.getChronologicalMessages(conversation.messages || []).map(
        (message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt: message.createdAt,
          intentType: message.intentType,
          intentConfidence: message.intentConfidence,
          policyRoute: message.policyRoute,
          escalationRequired: message.escalationRequired,
          reasons: message.policyReasons || [],
          boundaryType: normalizeBoundary(message.boundaryType),
          integrations: message.integrations,
          createdByUserId: message.createdByUserId ?? null,
          source: getMessageSource(message),
        }),
      ),
      notes: notes.map((note) => ({
        id: note.id,
        body: note.body,
        authorUserId: note.authorUserId ?? null,
        createdAt: note.createdAt,
      })),
    };
  }

  async assignConversation(
    conversationId: string,
    dto: AssignCustomerChatConversationDto,
  ) {
    const conversation = await this.findConversationOrThrow(conversationId);
    const previousAssignedToUserId = conversation.assignedToUserId ?? null;

    conversation.assignedToUserId = dto.assignedToUserId ?? null;
    const saved = await this.conversationRepository.save(conversation);
    if (previousAssignedToUserId !== (saved.assignedToUserId ?? null)) {
      this.chatEvents.publish({
        eventType: CUSTOMER_CHAT_EVENT_TYPES.ConversationAssigned,
        conversationId: saved.id,
        customerId: saved.customer.id,
        actorType: 'admin',
        actorUserId: null,
        intent: saved.lastIntentType,
        route: saved.lastPolicyRoute,
        status: saved.status,
        escalationRequired: saved.escalationRequired,
        priority: this.getPriority(saved, this.getReasonCodes(saved)),
        createdAt: new Date(),
        metadata: {
          publicConversationId: saved.conversationId,
          assignedToUserId: saved.assignedToUserId ?? null,
          previousAssignedToUserId,
        },
      });
    }

    return {
      conversationId: saved.conversationId,
      assignedTo: saved.assignedToUserId ?? null,
    };
  }

  async updateConversationStatus(
    conversationId: string,
    dto: UpdateCustomerChatConversationStatusDto,
  ) {
    if (!Object.values(CustomerChatConversationStatus).includes(dto.status)) {
      throw new BadRequestException(
        'Invalid customer chat conversation status.',
      );
    }

    const conversation = await this.findConversationOrThrow(conversationId);
    const previousStatus = conversation.status;
    conversation.status = dto.status;

    if (
      dto.status === CustomerChatConversationStatus.Resolved ||
      dto.status === CustomerChatConversationStatus.Closed
    ) {
      conversation.escalationRequired = false;
    }

    const saved = await this.conversationRepository.save(conversation);
    if (previousStatus !== saved.status) {
      const statusEvent = this.buildAdminConversationEvent(
        CUSTOMER_CHAT_EVENT_TYPES.StatusChanged,
        saved,
        {
          previousStatus,
          createdAt: new Date(),
          metadata: {
            publicConversationId: saved.conversationId,
          },
        },
      );
      this.chatEvents.publish(statusEvent);

      if (
        saved.status === CustomerChatConversationStatus.Resolved ||
        saved.status === CustomerChatConversationStatus.Closed
      ) {
        this.chatEvents.publish({
          ...statusEvent,
          eventType: CUSTOMER_CHAT_EVENT_TYPES.ConversationResolved,
        });
      }
    }

    return {
      conversationId: saved.conversationId,
      status: saved.status,
      escalationRequired: saved.escalationRequired,
    };
  }

  async addInternalNote(
    conversationId: string,
    dto: CreateCustomerChatInternalNoteDto,
    authorUserId?: number,
  ) {
    const conversation = await this.findConversationOrThrow(conversationId);
    const note = await this.noteRepository.save(
      this.noteRepository.create({
        conversation,
        authorUserId: authorUserId ?? null,
        body: dto.body,
      }),
    );
    this.chatEvents.publish({
      eventType: CUSTOMER_CHAT_EVENT_TYPES.InternalNoteCreated,
      conversationId: conversation.id,
      customerId: conversation.customer.id,
      actorType: 'admin',
      actorUserId: note.authorUserId ?? null,
      intent: conversation.lastIntentType,
      route: conversation.lastPolicyRoute,
      status: conversation.status,
      escalationRequired: conversation.escalationRequired,
      priority: this.getPriority(
        conversation,
        this.getReasonCodes(conversation),
      ),
      createdAt: note.createdAt,
      metadata: {
        publicConversationId: conversation.conversationId,
        noteId: note.id,
      },
    });

    return {
      id: note.id,
      conversationId,
      body: note.body,
      authorUserId: note.authorUserId ?? null,
      createdAt: note.createdAt,
    };
  }

  async sendHumanReply(
    conversationId: string,
    dto: CreateCustomerChatHumanReplyDto,
    authorUserId?: number,
  ) {
    this.assertReplyMessage(dto.message);

    const conversation = await this.findConversationOrThrow(conversationId);
    const now = new Date();
    const previousStatus = conversation.status;
    const message = await this.chatMessageRepository.save(
      this.chatMessageRepository.create({
        conversation,
        customer: conversation.customer,
        role: CustomerChatMessageRole.Human,
        content: dto.message.trim(),
        escalationRequired: false,
        policyRoute: 'human_reply',
        boundaryType: normalizeBoundary(conversation.lastBoundaryType),
        policyReasons: ['human_reply_sent'],
        integrations: rowIntegrationStatus(conversation.messages || []),
        createdByUserId: authorUserId ?? null,
        metadata: {
          source: 'human',
          decisionOwner: 'human_override',
        },
      }),
    );

    conversation.humanHandled = true;
    conversation.humanHandledAt = conversation.humanHandledAt ?? now;
    conversation.humanHandledByUserId =
      conversation.humanHandledByUserId ?? authorUserId ?? null;
    conversation.lastHumanReplyAt = now;
    conversation.escalationRequired = false;

    if (
      conversation.status === CustomerChatConversationStatus.Open ||
      conversation.status === CustomerChatConversationStatus.Escalated
    ) {
      conversation.status = CustomerChatConversationStatus.Pending;
    }

    const saved = await this.conversationRepository.save(conversation);
    this.chatEvents.publish({
      eventType: CUSTOMER_CHAT_EVENT_TYPES.HumanReplyCreated,
      conversationId: saved.id,
      customerId: saved.customer.id,
      messageId: message.id,
      actorType: 'admin',
      actorUserId: authorUserId ?? null,
      intent: saved.lastIntentType,
      route: 'human_reply',
      status: saved.status,
      previousStatus,
      escalationRequired: saved.escalationRequired,
      priority: this.getPriority(
        saved,
        uniqueStrings(
          [...(saved.messages || []), message].flatMap(
            (chatMessage) => chatMessage.policyReasons || [],
          ),
        ),
      ),
      createdAt: message.createdAt,
      metadata: {
        publicConversationId: saved.conversationId,
        humanHandled: saved.humanHandled,
      },
    });

    return {
      conversationId: saved.conversationId,
      message: {
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
        createdByUserId: message.createdByUserId ?? null,
        source: 'human',
      },
      status: saved.status,
      escalationRequired: saved.escalationRequired,
      humanHandled: saved.humanHandled,
      humanHandledAt: saved.humanHandledAt,
      humanHandledByUserId: saved.humanHandledByUserId ?? null,
      lastHumanReplyAt: saved.lastHumanReplyAt,
    };
  }

  private async findConversationOrThrow(conversationId: string) {
    const conversation = await this.conversationRepository.findOne({
      where: { conversationId },
      relations: { customer: true, messages: true },
    });

    if (!conversation) {
      throw new NotFoundException(
        `Customer chat conversation ${conversationId} not found`,
      );
    }

    return conversation;
  }

  private toInboxRow(
    conversation: CustomerChatConversation,
  ): AdminChatInboxRow {
    const messages = this.getChronologicalMessages(conversation.messages || []);
    const lastMessage = messages[messages.length - 1];
    const reasons = uniqueStrings(
      messages.flatMap((message) => message.policyReasons || []),
    );
    const priority = this.getPriority(conversation, reasons);

    return {
      conversationId: conversation.conversationId,
      customerId: conversation.customer.id,
      customerName: conversation.customer.name,
      customerEmail: conversation.customer.email,
      status: conversation.status,
      priority,
      lastIntent: conversation.lastIntentType,
      lastRoute: conversation.lastPolicyRoute,
      escalationRequired: conversation.escalationRequired,
      escalationReason: this.getEscalationReason(conversation, reasons),
      reasons,
      boundaryType: normalizeBoundary(conversation.lastBoundaryType),
      lastMessagePreview: preview(lastMessage?.content || ''),
      lastMessageAt: lastMessage?.createdAt,
      messageCount: messages.length,
      assignedTo: conversation.assignedToUserId ?? null,
      humanHandled: conversation.humanHandled,
      humanHandledAt: conversation.humanHandledAt,
      humanHandledByUserId: conversation.humanHandledByUserId ?? null,
      lastHumanReplyAt: conversation.lastHumanReplyAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  private isReviewWorthy(
    row: AdminChatInboxRow,
    query: AdminCustomerChatInboxQueryDto,
  ) {
    if (Object.keys(query).length) return true;

    if (
      row.status === CustomerChatConversationStatus.Resolved ||
      row.status === CustomerChatConversationStatus.Closed
    ) {
      return false;
    }

    return (
      row.escalationRequired ||
      row.priority !== 'low' ||
      row.status === CustomerChatConversationStatus.Escalated ||
      row.status === CustomerChatConversationStatus.Pending
    );
  }

  private matchesFilters(
    row: AdminChatInboxRow,
    query: AdminCustomerChatInboxQueryDto,
  ) {
    if (query.status && row.status !== query.status) return false;
    const customerIdFilter = parseNumberFilter(query.customerId);
    if (
      typeof customerIdFilter === 'number' &&
      row.customerId !== customerIdFilter
    ) {
      return false;
    }
    const assignedToFilter = parseNumberFilter(query.assignedTo);
    if (
      typeof assignedToFilter === 'number' &&
      row.assignedTo !== assignedToFilter
    ) {
      return false;
    }
    if (query.route && row.lastRoute !== query.route) return false;
    if (query.intent && row.lastIntent !== query.intent) return false;
    if (query.priority && row.priority !== query.priority) return false;

    const escalationFilter = parseBooleanFilter(query.escalationRequired);
    if (
      typeof escalationFilter === 'boolean' &&
      row.escalationRequired !== escalationFilter
    ) {
      return false;
    }

    return true;
  }

  private getPriority(
    conversation: CustomerChatConversation,
    reasons: string[],
  ): AdminChatPriority {
    if (
      normalizeBoundary(conversation.lastBoundaryType) === 'unsafe' ||
      conversation.lastIntentType === 'safety_concern' ||
      conversation.lastIntentType === 'escalation_request' ||
      reasons.includes('repeated_customer_frustration')
    ) {
      return 'high';
    }

    if (
      conversation.lastPolicyRoute === 'support' ||
      conversation.lastIntentType === 'frustration' ||
      conversation.lastIntentType === 'mixed_support_recommendation'
    ) {
      return 'medium';
    }

    return 'low';
  }

  private getEscalationReason(
    conversation: CustomerChatConversation,
    reasons: string[],
  ) {
    if (!conversation.escalationRequired && !reasons.length) return undefined;

    return (
      reasons[0] || conversation.lastIntentType || conversation.lastPolicyRoute
    );
  }

  private getChronologicalMessages(messages: CustomerChatMessage[]) {
    return [...messages].sort(
      (a, b) => getTimestamp(a.createdAt) - getTimestamp(b.createdAt),
    );
  }

  private getReasonCodes(conversation: CustomerChatConversation) {
    return uniqueStrings(
      (conversation.messages || []).flatMap(
        (message) => message.policyReasons || [],
      ),
    );
  }

  private buildAdminConversationEvent(
    eventType: CustomerChatEventPayload['eventType'],
    conversation: CustomerChatConversation,
    overrides: Partial<CustomerChatEventPayload> = {},
  ): CustomerChatEventPayload {
    return {
      eventType,
      conversationId: conversation.id,
      customerId: conversation.customer.id,
      actorType: 'admin',
      actorUserId: null,
      intent: conversation.lastIntentType,
      route: conversation.lastPolicyRoute,
      status: conversation.status,
      escalationRequired: conversation.escalationRequired,
      priority: this.getPriority(
        conversation,
        this.getReasonCodes(conversation),
      ),
      createdAt: new Date(),
      ...overrides,
    };
  }

  private assertReplyMessage(message: string) {
    if (!message || message.trim().length < 2) {
      throw new BadRequestException(
        'Human reply message must contain at least 2 non-whitespace characters.',
      );
    }
  }
}

function rowIntegrationStatus(messages: CustomerChatMessage[]) {
  const latest = [...messages]
    .sort((a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt))
    .find((message) => message.integrations);

  return latest?.integrations;
}

function getMessageSource(message: CustomerChatMessage) {
  const source = message.metadata?.source;

  if (typeof source === 'string') return source;
  if (message.role === CustomerChatMessageRole.Human) return 'human';

  return message.role;
}

function parseBooleanFilter(value: string | undefined) {
  if (value === undefined) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;

  return undefined;
}

function parseNumberFilter(value: string | undefined) {
  if (value === undefined) return undefined;

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeBoundary(value: string | undefined) {
  if (value === 'unsafe' || value === 'inappropriate' || value === 'medical') {
    return value;
  }

  return 'none';
}

function preview(value: string) {
  return value.length > 140 ? `${value.slice(0, 137)}...` : value;
}

function uniqueStrings(values: Array<string | undefined | null>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value))),
  );
}

function hasFrustrationSignal(conversation: CustomerChatConversation) {
  return (
    hasIntentSignal(conversation, ['frustration']) ||
    hasReasonSignal(conversation, 'customer_frustration_detected') ||
    hasReasonSignal(conversation, 'repeated_customer_frustration')
  );
}

function hasOffTopicSignal(conversation: CustomerChatConversation) {
  return (
    hasIntentSignal(conversation, ['off_topic']) ||
    hasRouteSignal(conversation, ['off_topic']) ||
    hasReasonSignal(conversation, 'off_topic_for_customer_core')
  );
}

function hasUnsafeSignal(conversation: CustomerChatConversation) {
  return (
    hasBoundarySignal(conversation, ['unsafe', 'inappropriate']) ||
    hasRouteSignal(conversation, ['boundary']) ||
    hasIntentSignal(conversation, [
      'unsafe_or_inappropriate',
      'abusive_language',
    ])
  );
}

function hasMixedIntentSignal(conversation: CustomerChatConversation) {
  return (
    hasIntentSignal(conversation, ['mixed_support_recommendation']) ||
    hasReasonSignal(conversation, 'mixed_support_recommendation_intent')
  );
}

function hasRecommendationSignal(conversation: CustomerChatConversation) {
  return (
    hasRouteSignal(conversation, ['recommendation']) ||
    hasIntentSignal(conversation, ['product_recommendation']) ||
    hasReasonSignal(conversation, 'recommendation_intent_detected')
  );
}

function hasSupportSignal(conversation: CustomerChatConversation) {
  return (
    hasRouteSignal(conversation, ['support']) ||
    hasIntentSignal(conversation, ['support_request']) ||
    hasReasonSignal(conversation, 'support_intent_detected')
  );
}

function hasIntentSignal(
  conversation: CustomerChatConversation,
  values: string[],
) {
  return getIntentSignals(conversation).some((signal) =>
    values.includes(signal),
  );
}

function hasRouteSignal(
  conversation: CustomerChatConversation,
  values: string[],
) {
  return getRouteSignals(conversation).some((signal) =>
    values.includes(signal),
  );
}

function hasBoundarySignal(
  conversation: CustomerChatConversation,
  values: string[],
) {
  return getBoundarySignals(conversation).some((signal) =>
    values.includes(signal),
  );
}

function hasReasonSignal(
  conversation: CustomerChatConversation,
  value: string,
) {
  return getReasonSignals(conversation).includes(value);
}

function getIntentSignals(conversation: CustomerChatConversation) {
  return uniqueStrings([
    conversation.lastIntentType,
    ...(conversation.messages || []).map((message) => message.intentType),
  ]);
}

function getRouteSignals(conversation: CustomerChatConversation) {
  return uniqueStrings([
    conversation.lastPolicyRoute,
    ...(conversation.messages || []).map((message) => message.policyRoute),
  ]);
}

function getBoundarySignals(conversation: CustomerChatConversation) {
  return uniqueStrings([
    normalizeBoundary(conversation.lastBoundaryType),
    ...(conversation.messages || []).map((message) =>
      normalizeBoundary(message.boundaryType),
    ),
  ]);
}

function getReasonSignals(conversation: CustomerChatConversation) {
  return uniqueStrings(
    (conversation.messages || []).flatMap((message) =>
      Array.isArray(message.policyReasons) ? message.policyReasons : [],
    ),
  );
}

function rate(count: number, total: number) {
  if (total <= 0) return 0;

  return Math.round((count / total) * 100) / 100;
}

function getPriorityRank(priority: AdminChatPriority) {
  if (priority === 'high') return 3;
  if (priority === 'medium') return 2;
  return 1;
}

function getTimestamp(value: Date | undefined) {
  return value instanceof Date ? value.getTime() : 0;
}
