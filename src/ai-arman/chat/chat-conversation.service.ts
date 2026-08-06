import { BadRequestException, Injectable } from '@nestjs/common';
import { ChatConversationStateStore } from './chat-conversation-state.store';
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

@Injectable()
export class ChatConversationService {
  constructor(
    private readonly messages: ChatMessagesService,
    private readonly stateStore: ChatConversationStateStore,
  ) {}

  handle(input: AiArmanChatRequest): AiArmanChatResponse {
    const previous = this.loadPreviousState(input);
    const current = this.messages.handle(input);
    const interpretation = this.mergeInterpretation(
      current.interpretation,
      previous,
    );
    const decision = this.decideFromMergedInterpretation(
      current.decision,
      interpretation,
    );
    const state = this.mergeState(current.state, previous, interpretation, decision);
    const blocks = this.composeBlocks(current.blocks, interpretation, decision);

    this.stateStore.save(state);

    return {
      ...current,
      interpretation,
      decision,
      state,
      blocks,
    };
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

    if (primaryIntent === 'product_recommendation' && requestedProductTypes.length === 0) {
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
