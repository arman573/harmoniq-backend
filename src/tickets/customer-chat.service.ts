import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './customer.entity';
import { ChatEventsService } from './chat-events.service';
import {
  CUSTOMER_CHAT_EVENT_TYPES,
  CustomerChatEventPayload,
} from './customer-chat-events';
import {
  CustomerChatConversation,
  CustomerChatConversationStatus,
} from './customer-chat-conversation.entity';
import { CustomerChatRequestDto } from './customer-chat.dto';
import { CustomerChatIntentService } from './customer-chat-intent.service';
import {
  CustomerChatMessage,
  CustomerChatMessageRole,
} from './customer-chat-message.entity';
import { CustomerChatPolicyService } from './customer-chat-policy.service';
import { CustomerChatResponseComposerService } from './customer-chat-response-composer.service';
import {
  CustomerChatHistoryResult,
  CustomerChatIntegrationStatus,
  CustomerChatPolicyDecision,
  CustomerChatResult,
} from './customer-chat.types';
import { CustomerFact } from './customer-fact.entity';
import { CustomerIntelligenceService } from './customer-intelligence.service';
import { SupportIntegrationService } from './support-integration.service';
import {
  buildBeautyProfileSummary,
  buildUnifiedBeautyProfile,
} from './unified-beauty-profile';

@Injectable()
export class CustomerChatService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(CustomerFact)
    private readonly customerFactRepository: Repository<CustomerFact>,
    @InjectRepository(CustomerChatConversation)
    private readonly conversationRepository: Repository<CustomerChatConversation>,
    @InjectRepository(CustomerChatMessage)
    private readonly chatMessageRepository: Repository<CustomerChatMessage>,
    private readonly intentService: CustomerChatIntentService,
    private readonly policyService: CustomerChatPolicyService,
    private readonly responseComposer: CustomerChatResponseComposerService,
    private readonly chatEvents: ChatEventsService,
    private readonly supportIntegrationService: SupportIntegrationService,
    private readonly intelligenceService: CustomerIntelligenceService,
  ) {}

  async handleCustomerChat(
    customerId: number,
    input: CustomerChatRequestDto,
  ): Promise<CustomerChatResult> {
    this.assertUsableMessage(input.message);

    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
    });
    if (!customer)
      throw new NotFoundException(`Customer ${customerId} not found`);

    const conversationId = this.getConversationId(customerId, input);
    const conversation = await this.getOrCreateConversation(
      customer,
      conversationId,
      input.channel ?? 'web',
    );
    const intent = this.intentService.understand(input.message);
    const policy = this.policyService.decide(customerId, intent, {
      repeatedFrustration:
        intent.type === 'frustration'
          ? await this.hasRepeatedFrustration(conversation)
          : false,
    });
    const existingFacts = await this.customerFactRepository.find({
      where: { customer: { id: customerId } },
    });
    const capturedFacts = policy.captureCustomerFacts
      ? await this.intelligenceService.extractFactsFromMessage(
          customer,
          input.message,
        )
      : [];
    const profileFacts = [...existingFacts, ...capturedFacts];
    const unifiedBeautyProfile = buildUnifiedBeautyProfile(
      customerId,
      profileFacts,
    );
    const beautyProfileSummary =
      buildBeautyProfileSummary(unifiedBeautyProfile);
    const response = this.responseComposer.compose({
      intent,
      policy,
      beautyProfileSummary,
      domainsDetected: beautyProfileSummary.domainsDetected,
    });
    const integrations = {
      recommendations: this.getRecommendationIntegration(customerId, policy),
      support: this.getSupportIntegration({
        customerId,
        conversation,
        intent,
        message: input.message,
        policy,
      }),
    };
    const generatedAt = new Date().toISOString();

    const audit = await this.persistChatTurn({
      customer,
      conversation,
      input,
      intent,
      policy,
      responseText: response.text,
      integrations,
      generatedAt,
    });

    await this.intelligenceService.createEvent({
      customer,
      type: 'customer_chat_turn',
      payload: {
        conversationId,
        channel: input.channel ?? 'web',
        messagePreview: input.message.slice(0, 200),
        intentType: intent.type,
        intentConfidence: intent.confidence,
        route: policy.route,
        escalationRequired: policy.escalation.required,
        reasons: policy.reasons,
        boundaryType: policy.boundary.type,
        aiUsed: false,
      },
    });

    return {
      customerId,
      conversationId: conversation.conversationId,
      message: response.text,
      intent,
      route: policy.route,
      policy,
      escalationRequired: policy.escalation.required,
      confidence: intent.confidence,
      reasons: policy.reasons,
      suggestedActions: policy.nextActions,
      response,
      beautyProfileSummary,
      capturedFactsCount: capturedFacts.length,
      integrations,
      metadata: {
        aiUsed: false,
        decisionOwner: 'backend_policy',
        handledBy: 'harmoniq_customer_core_v1',
        generatedAt,
      },
      audit,
    };
  }

  async getCustomerChatHistory(
    customerId: number,
  ): Promise<CustomerChatHistoryResult> {
    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
    });
    if (!customer)
      throw new NotFoundException(`Customer ${customerId} not found`);

    const conversations = await this.conversationRepository.find({
      where: { customer: { id: customerId } },
      relations: { messages: true },
      order: { updatedAt: 'DESC' },
    });

    return {
      customerId,
      conversations: conversations.map((conversation) => ({
        id: conversation.id,
        customerId,
        conversationId: conversation.conversationId,
        channel: conversation.channel,
        status: conversation.status,
        lastIntentType: conversation.lastIntentType,
        lastIntentConfidence: conversation.lastIntentConfidence,
        lastPolicyRoute: conversation.lastPolicyRoute,
        boundaryType: this.getBoundaryType(conversation.lastBoundaryType),
        escalationRequired: conversation.escalationRequired,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        messages: [...(conversation.messages || [])]
          .sort(
            (a, b) =>
              this.getTimestamp(a.createdAt) - this.getTimestamp(b.createdAt),
          )
          .map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
            intentType: message.intentType,
            intentConfidence: message.intentConfidence,
            policyRoute: message.policyRoute,
            escalationRequired: message.escalationRequired,
            reasons: message.policyReasons || [],
            boundaryType: this.getBoundaryType(message.boundaryType),
            integrations: message.integrations,
            createdAt: message.createdAt,
          })),
      })),
    };
  }

  private getConversationId(customerId: number, input: CustomerChatRequestDto) {
    const provided = input.conversationId?.trim();

    return provided || `customer-${customerId}-${Date.now()}`;
  }

  private async getOrCreateConversation(
    customer: Customer,
    conversationId: string,
    channel: CustomerChatConversation['channel'],
  ) {
    const existing = await this.conversationRepository.findOne({
      where: {
        customer: { id: customer.id },
        conversationId,
      },
    });

    if (existing) return existing;

    return this.conversationRepository.save(
      this.conversationRepository.create({
        customer,
        conversationId,
        channel,
        status: CustomerChatConversationStatus.Open,
        escalationRequired: false,
      }),
    );
  }

  private async persistChatTurn(input: {
    customer: Customer;
    conversation: CustomerChatConversation;
    input: CustomerChatRequestDto;
    intent: CustomerChatResult['intent'];
    policy: CustomerChatPolicyDecision;
    responseText: string;
    integrations: {
      recommendations: CustomerChatIntegrationStatus;
      support: CustomerChatIntegrationStatus;
    };
    generatedAt: string;
  }) {
    const previouslyEscalated = input.conversation.escalationRequired;
    const audit = {
      intentType: input.intent.type,
      intentConfidence: input.intent.confidence,
      policyRoute: input.policy.route,
      escalationRequired: input.policy.escalation.required,
      boundaryType: input.policy.boundary.type,
      policyReasons: input.policy.reasons,
    };

    const savedMessages = await this.chatMessageRepository.save([
      this.chatMessageRepository.create({
        customer: input.customer,
        conversation: input.conversation,
        role: CustomerChatMessageRole.User,
        content: input.input.message,
        ...audit,
        intent: input.intent,
        policyDecision: input.policy,
        integrations: input.integrations,
        metadata: {
          channel: input.input.channel ?? input.conversation.channel,
          conversationId: input.conversation.conversationId,
          context: input.input.context,
          aiUsed: false,
          decisionOwner: 'backend_policy',
        },
      }),
      this.chatMessageRepository.create({
        customer: input.customer,
        conversation: input.conversation,
        role: CustomerChatMessageRole.Assistant,
        content: input.responseText,
        ...audit,
        intent: input.intent,
        policyDecision: input.policy,
        integrations: input.integrations,
        metadata: {
          generatedAt: input.generatedAt,
          aiUsed: false,
          decisionOwner: 'backend_policy',
          handledBy: 'harmoniq_customer_core_v1',
        },
      }),
    ]);

    input.conversation.lastIntentType = input.intent.type;
    input.conversation.lastIntentConfidence = input.intent.confidence;
    input.conversation.lastPolicyRoute = input.policy.route;
    input.conversation.lastBoundaryType = input.policy.boundary.type;
    input.conversation.escalationRequired = input.policy.escalation.required;
    input.conversation.status = input.policy.escalation.required
      ? CustomerChatConversationStatus.Escalated
      : CustomerChatConversationStatus.Open;

    const savedConversation = await this.conversationRepository.save(
      input.conversation,
    );
    const userMessage = savedMessages.find(
      (message) => message.role === CustomerChatMessageRole.User,
    );
    const assistantMessage = savedMessages.find(
      (message) => message.role === CustomerChatMessageRole.Assistant,
    );

    const events: CustomerChatEventPayload[] = [
      {
        eventType: CUSTOMER_CHAT_EVENT_TYPES.CustomerMessageCreated,
        conversationId: savedConversation.id,
        customerId: input.customer.id,
        messageId: userMessage?.id,
        actorType: 'customer',
        intent: input.intent.type,
        route: input.policy.route,
        status: savedConversation.status,
        escalationRequired: input.policy.escalation.required,
        priority: input.policy.escalation.priority,
        createdAt: userMessage?.createdAt ?? input.generatedAt,
        metadata: {
          publicConversationId: savedConversation.conversationId,
          channel: input.input.channel ?? input.conversation.channel,
          boundaryType: input.policy.boundary.type,
          reasonCodes: input.policy.reasons,
          aiUsed: false,
        },
      },
      {
        eventType: CUSTOMER_CHAT_EVENT_TYPES.AssistantResponseCreated,
        conversationId: savedConversation.id,
        customerId: input.customer.id,
        messageId: assistantMessage?.id,
        actorType: 'assistant',
        intent: input.intent.type,
        route: input.policy.route,
        status: savedConversation.status,
        escalationRequired: input.policy.escalation.required,
        priority: input.policy.escalation.priority,
        createdAt: assistantMessage?.createdAt ?? input.generatedAt,
        metadata: {
          publicConversationId: savedConversation.conversationId,
          boundaryType: input.policy.boundary.type,
          reasonCodes: input.policy.reasons,
          aiUsed: false,
        },
      },
    ];

    if (input.policy.escalation.required && !previouslyEscalated) {
      events.push({
        eventType: CUSTOMER_CHAT_EVENT_TYPES.ConversationEscalated,
        conversationId: savedConversation.id,
        customerId: input.customer.id,
        actorType: 'system',
        intent: input.intent.type,
        route: input.policy.route,
        status: savedConversation.status,
        escalationRequired: true,
        priority: input.policy.escalation.priority,
        createdAt: input.generatedAt,
        metadata: {
          publicConversationId: savedConversation.conversationId,
          boundaryType: input.policy.boundary.type,
          escalationReason:
            input.policy.escalation.reason ?? input.policy.reasons[0],
          reasonCodes: input.policy.reasons,
        },
      });
    }

    this.chatEvents.publishMany(events);

    return {
      userMessageId: userMessage?.id,
      assistantMessageId: assistantMessage?.id,
      boundaryType: input.policy.boundary.type,
      createdAt: input.generatedAt,
    };
  }

  private getTimestamp(value: Date | undefined) {
    return value instanceof Date ? value.getTime() : 0;
  }

  private assertUsableMessage(message: string) {
    if (!message || message.trim().length < 2) {
      throw new BadRequestException(
        'Customer chat message must contain at least 2 non-whitespace characters.',
      );
    }
  }

  private async hasRepeatedFrustration(conversation: CustomerChatConversation) {
    const count = await this.chatMessageRepository.count({
      where: {
        conversation: { id: conversation.id },
        intentType: 'frustration',
      },
    });

    return count > 0;
  }

  private getBoundaryType(value: string | undefined) {
    if (
      value === 'unsafe' ||
      value === 'inappropriate' ||
      value === 'medical'
    ) {
      return value;
    }

    return 'none';
  }

  private getRecommendationIntegration(
    customerId: number,
    policy: ReturnType<CustomerChatPolicyService['decide']>,
  ) {
    const recommendationAction = policy.nextActions.find(
      (action) => action.type === 'fetch_recommendations',
    );

    if (!recommendationAction) return { status: 'not_required' as const };

    return {
      status: recommendationAction.status,
      endpoint:
        recommendationAction.endpoint ??
        `/customers/${customerId}/recommendations`,
      note: 'Recommendation engine is invoked through the dedicated recommendations endpoint.',
    };
  }

  private getSupportIntegration(input: {
    customerId: number;
    conversation: CustomerChatConversation;
    intent: CustomerChatResult['intent'];
    message: string;
    policy: ReturnType<CustomerChatPolicyService['decide']>;
  }): CustomerChatIntegrationStatus {
    const supportAction = input.policy.nextActions.find(
      (action) => action.type === 'support_handoff',
    );

    if (!supportAction) return { status: 'not_required' };

    const capability = this.supportIntegrationService.inferCapability({
      message: input.message,
      intentType: input.intent.type,
      route: input.policy.route,
    });
    const placeholder = this.supportIntegrationService.createPlaceholderResult(
      capability,
      {
        customerId: input.customerId,
        conversationId: input.conversation.id,
        intentType: input.intent.type,
        route: input.policy.route,
      },
    );

    return {
      status: supportAction.status,
      capability: placeholder.capability,
      integrationStatus: placeholder.status,
      handled: placeholder.handled,
      requiresHuman: placeholder.requiresHuman,
      missingFields: placeholder.missingFields,
      safeCustomerMessage: placeholder.safeCustomerMessage,
      externalReference: placeholder.externalReference,
      note: placeholder.safeCustomerMessage,
    };
  }
}
