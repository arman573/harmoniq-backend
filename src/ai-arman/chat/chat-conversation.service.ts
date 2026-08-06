import {
  BadRequestException,
  Injectable,
  Optional,
} from '@nestjs/common';
import {
  ChatConversationResultRepository,
  ChatConversationStateRepository,
} from './chat-conversation.repositories';
import { ChatInterpretationShadowOrchestrator } from './chat-interpretation-shadow-orchestrator.service';
import { ChatMessagesService } from './chat-messages.service';
import type {
  AiArmanChatRequest,
  AiArmanChatResponse,
  AiArmanConversationState,
  AiArmanDecision,
  AiArmanInterpretation,
  AiArmanProductType,
  AiArmanResponseBlock,
} from './chat-messages.types';

type ProcessedChatMessage = {
  response: AiArmanChatResponse;
  previousState: AiArmanConversationState | null;
  replayed: boolean;
};

@Injectable()
export class ChatConversationService {
  constructor(
    private readonly messages: ChatMessagesService,
    private readonly stateStore: ChatConversationStateRepository,
    private readonly resultStore: ChatConversationResultRepository,
    @Optional()
    private readonly shadowOrchestrator?: ChatInterpretationShadowOrchestrator,
  ) {}

  handle(input: AiArmanChatRequest): AiArmanChatResponse {
    return this.process(input).response;
  }

  async handleWithShadow(
    input: AiArmanChatRequest,
  ): Promise<AiArmanChatResponse> {
    const processed = this.process(input);

    if (!processed.replayed && this.shadowOrchestrator) {
      await this.shadowOrchestrator.run(processed.response.interpretation, {
        text: input.message.text,
        locale: 'sv-SE',
        previousState: processed.previousState,
      });
    }

    return processed.response;
  }

  private process(input: AiArmanChatRequest): ProcessedChatMessage {
    const idempotencyKey = this.createIdempotencyKey(input);
    const fingerprint = this.createRequestFingerprint(input);
    const stored = this.resultStore.get(idempotencyKey);

    if (stored) {
      if (stored.fingerprint !== fingerprint) {
        throw new BadRequestException('client_message_id_conflict');
      }
      return {
        response: stored.response,
        previousState: null,
        replayed: true,
      };
    }

    const previousState = this.loadPreviousState(input);
    const current = this.messages.handle(input);
    const interpretation = this.mergeInterpretation(
      current.interpretation,
      previousState,
    );
    const decision = this.decideFromMergedInterpretation(
      current.decision,
      interpretation,
    );
    const state = this.mergeState(
      current.state,
      previousState,
      interpretation,
      decision,
    );
    const blocks = this.composeBlocks(
      current.blocks,
      interpretation,
      decision,
    );

    this.stateStore.save(state);

    const response = {
      ...current,
      interpretation,
      decision,
      state,
      blocks,
    };

    return {
      response: this.resultStore.save(
        idempotencyKey,
        fingerprint,
        response,
      ),
      previousState,
      replayed: false,
    };
  }

  private createIdempotencyKey(input: AiArmanChatRequest) {
    const scope = input.conversationId?.trim() || 'new-conversation';
    return `${scope}:${input.clientMessageId.trim()}`;
  }

  private createRequestFingerprint(input: AiArmanChatRequest) {
    return JSON.stringify({
      contractVersion: input.contractVersion,
      conversationId: input.conversationId?.trim() || null,
      clientMessageId: input.clientMessageId.trim(),
      messageText: input.message?.text?.trim() || '',
      context: input.context ?? null,
    });
  }

  private loadPreviousState(
    input: AiArmanChatRequest,
  ): AiArmanConversationState | null {
    const conversationId = input.conversationId?.trim();
    if (!conversationId) return null;

    const state = this.stateStore.get(conversationId);
    if (!state) {
      throw new BadRequestException('conversation_not_found');
    }
    return state;
  }

  private mergeInterpretation(
    current: AiArmanInterpretation,
    previous: AiArmanConversationState | null,
  ): AiArmanInterpretation {
    const requestedProductTypes = unique([
      ...(previous?.remembered.requestedProductTypes ?? []),
      ...current.entities.requestedProductTypes,
    ]);
    const needs = unique([
      ...(previous?.remembered.needs ?? []),
      ...current.entities.needs,
    ]);
    const exclusions = unique([
      ...(previous?.remembered.exclusions ?? []),
      ...current.entities.exclusions,
    ]);
    const productReferences = unique([
      ...(previous?.remembered.productReferences ?? []),
      ...current.entities.productReferences,
    ]);
    const orderReference =
      current.entities.orderReference ??
      previous?.remembered.orderReference ??
      null;

    const productJourneyContinues =
      previous?.activeJourney === 'before_purchase' ||
      previous?.pendingQuestion?.expectedField === 'requestedProductType' ||
      current.primaryIntent === 'product_recommendation' ||
      (current.primaryIntent === 'unknown' && needs.length > 0);

    const primaryIntent = productJourneyContinues
      ? 'product_recommendation'
      : current.primaryIntent;
    const missingFields = current.missingFields.filter(
      (field) => field !== 'requestedProductType',
    );

    if (
      primaryIntent === 'product_recommendation' &&
      requestedProductTypes.length === 0
    ) {
      missingFields.unshift('requestedProductType');
    }

    return {
      ...current,
      primaryIntent,
      confidence:
        primaryIntent === current.primaryIntent
          ? current.confidence
          : Math.max(current.confidence, 0.68),
      entities: {
        requestedProductTypes,
        needs,
        exclusions,
        orderReference,
        productReferences,
      },
      missingFields: unique(missingFields),
      requiresIdentity:
        current.requiresIdentity ||
        previous?.activeJourney === 'after_purchase' ||
        previous?.activeJourney === 'customer_service' ||
        false,
    };
  }

  private decideFromMergedInterpretation(
    current: AiArmanDecision,
    interpretation: AiArmanInterpretation,
  ): AiArmanDecision {
    if (interpretation.primaryIntent !== 'product_recommendation') {
      return current;
    }

    const ready = interpretation.missingFields.length === 0;
    return {
      owner: 'backend_policy',
      route: 'recommendation',
      plannedTools: ready
        ? [
            'search_products',
            'analyze_product_suitability',
            'get_product_live_facts',
          ]
        : [],
      executionStatus: 'not_executed_foundation',
      requiresIdentity: false,
      requiresConfirmation: false,
      reasons: ready
        ? ['multi_turn_need_profile_ready_for_backend_tools']
        : ['clarification_required_before_product_search'],
    };
  }

  private mergeState(
    current: AiArmanConversationState,
    previous: AiArmanConversationState | null,
    interpretation: AiArmanInterpretation,
    decision: AiArmanDecision,
  ): AiArmanConversationState {
    const pendingQuestion = interpretation.missingFields.includes(
      'requestedProductType',
    )
      ? {
          id: 'requested-product-type',
          expectedField: 'requestedProductType',
        }
      : current.pendingQuestion?.expectedField === 'verifiedOrderIdentity'
        ? current.pendingQuestion
        : null;

    return {
      ...current,
      conversationId: previous?.conversationId ?? current.conversationId,
      status:
        decision.route === 'human_support'
          ? 'handoff_required'
          : pendingQuestion
            ? 'collecting'
            : 'ready_for_tools',
      activeJourney:
        interpretation.primaryIntent === 'product_recommendation'
          ? 'before_purchase'
          : current.activeJourney,
      remembered: {
        requestedProductTypes: interpretation.entities.requestedProductTypes,
        needs: interpretation.entities.needs,
        exclusions: interpretation.entities.exclusions,
        orderReference: interpretation.entities.orderReference,
        productReferences: interpretation.entities.productReferences,
      },
      pendingQuestion,
    };
  }

  private composeBlocks(
    current: AiArmanResponseBlock[],
    interpretation: AiArmanInterpretation,
    decision: AiArmanDecision,
  ): AiArmanResponseBlock[] {
    if (interpretation.missingFields.includes('requestedProductType')) {
      return [
        {
          type: 'message',
          text: 'Jag har sparat det du berättat om håret. Jag behöver bara veta vilken typ av produkt du söker.',
        },
        {
          type: 'question',
          id: 'requested-product-type',
          text: 'Söker du schampo, balsam, hårinpackning eller leave-in?',
          expectedField: 'requestedProductType',
          required: true,
        },
      ];
    }

    if (
      interpretation.primaryIntent === 'product_recommendation' &&
      decision.plannedTools.length > 0
    ) {
      return [
        {
          type: 'message',
          text: 'Tack, nu har jag ett sammanhängande behov. Backend kan gå vidare till kandidatsökning och kvalitetsgranskning.',
        },
      ];
    }

    return current;
  }
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function isSupportedProductType(
  value: string,
): value is AiArmanProductType {
  return ['shampoo', 'conditioner', 'hair_mask', 'leave_in'].includes(value);
}
