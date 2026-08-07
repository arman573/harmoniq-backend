import {
  BadRequestException,
  Injectable,
  Optional,
} from '@nestjs/common';
import { HaircareRecommendationJourneyService } from '../discovery/haircare-recommendation-journey.service';
import type { ProductRecommendationCard } from '../recommendation/product-recommendation-card.types';
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
  AiArmanProductCardBlock,
  AiArmanProductType,
  AiArmanResponseBlock,
} from './chat-messages.types';
import { ProductCardBlockMapper } from './product-card-block.mapper';

type ProcessedChatMessage = {
  response: AiArmanChatResponse;
  previousState: AiArmanConversationState | null;
  replayed: boolean;
  idempotencyKey: string;
  fingerprint: string;
};

type RecommendationJourneyStatus =
  | 'no_verified_candidates'
  | 'live_facts_unavailable'
  | 'no_verified_live_products'
  | 'product_cards_ready';

@Injectable()
export class ChatConversationService {
  constructor(
    private readonly messages: ChatMessagesService,
    private readonly stateStore: ChatConversationStateRepository,
    private readonly resultStore: ChatConversationResultRepository,
    @Optional()
    private readonly shadowOrchestrator?: ChatInterpretationShadowOrchestrator,
    @Optional()
    private readonly recommendationJourney?: HaircareRecommendationJourneyService,
    @Optional()
    private readonly productCardBlockMapper?: ProductCardBlockMapper,
  ) {}

  handle(input: AiArmanChatRequest): AiArmanChatResponse {
    return this.process(input).response;
  }

  async handleWithShadow(
    input: AiArmanChatRequest,
  ): Promise<AiArmanChatResponse> {
    const processed = this.process(input);

    if (processed.replayed) {
      return processed.response;
    }

    if (this.shadowOrchestrator) {
      await this.shadowOrchestrator.run(processed.response.interpretation, {
        text: input.message.text,
        locale: 'sv-SE',
        previousState: processed.previousState,
      });
    }

    if (
      this.recommendationJourney &&
      this.shouldExecuteRecommendationJourney(processed.response)
    ) {
      return this.executeRecommendationJourney(processed);
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
        idempotencyKey,
        fingerprint,
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
      idempotencyKey,
      fingerprint,
    };
  }

  private shouldExecuteRecommendationJourney(
    response: AiArmanChatResponse,
  ): boolean {
    const requiredTools = [
      'search_products',
      'analyze_product_suitability',
      'get_product_live_facts',
    ] as const;

    return (
      response.interpretation.primaryIntent === 'product_recommendation' &&
      response.interpretation.missingFields.length === 0 &&
      response.state.status === 'ready_for_tools' &&
      response.decision.owner === 'backend_policy' &&
      response.decision.route === 'recommendation' &&
      requiredTools.every((tool) => response.decision.plannedTools.includes(tool))
    );
  }

  private async executeRecommendationJourney(
    processed: ProcessedChatMessage,
  ): Promise<AiArmanChatResponse> {
    try {
      const result = await this.recommendationJourney!.prepare(
        processed.response.interpretation,
      );
      const status = result.status as RecommendationJourneyStatus;
      const response = this.applyRecommendationJourneyResult(
        processed.response,
        status,
        result.productCards as ProductRecommendationCard[],
      );

      return this.resultStore.save(
        processed.idempotencyKey,
        processed.fingerprint,
        response,
      );
    } catch {
      const response: AiArmanChatResponse = {
        ...processed.response,
        decision: {
          ...processed.response.decision,
          executionStatus: 'failed_closed',
          reasons: unique([
            ...processed.response.decision.reasons,
            'recommendation_journey_failed_closed',
          ]),
        },
        blocks: [
          {
            type: 'message',
            text: 'Jag kan inte verifiera rekommendationerna säkert just nu, så jag visar inga produkter.',
          },
          {
            type: 'error_notice',
            code: 'recommendation_temporarily_unavailable',
            text: 'Produktrekommendationerna kunde inte verifieras just nu.',
            retryable: true,
          },
        ],
      };

      return this.resultStore.save(
        processed.idempotencyKey,
        processed.fingerprint,
        response,
      );
    }
  }

  private applyRecommendationJourneyResult(
    response: AiArmanChatResponse,
    status: RecommendationJourneyStatus,
    productCards: ProductRecommendationCard[],
  ): AiArmanChatResponse {
    const liveFactsUsed =
      status === 'no_verified_live_products' || status === 'product_cards_ready';
    const executionStatus =
      status === 'live_facts_unavailable'
        ? ('failed_closed' as const)
        : ('executed_read_only' as const);
    const productCardBlock = this.composeProductCardBlock(status, productCards);

    return {
      ...response,
      decision: {
        ...response.decision,
        executionStatus,
        reasons: unique([
          ...response.decision.reasons,
          `recommendation_journey:${status}`,
        ]),
      },
      blocks: this.composeRecommendationExecutionBlocks(status, productCardBlock),
      safety: {
        ...response.safety,
        liveFactsUsed,
      },
    };
  }

  private composeProductCardBlock(
    status: RecommendationJourneyStatus,
    productCards: ProductRecommendationCard[],
  ): AiArmanProductCardBlock | null {
    if (status !== 'product_cards_ready') return null;
    if (!this.productCardBlockMapper) {
      throw new BadRequestException('product_card_block_mapper_required');
    }

    const block = this.productCardBlockMapper.compose(productCards);
    if (!block || block.cards.length === 0) {
      throw new BadRequestException('verified_product_cards_required');
    }
    return block;
  }

  private composeRecommendationExecutionBlocks(
    status: RecommendationJourneyStatus,
    productCardBlock: AiArmanProductCardBlock | null,
  ): AiArmanResponseBlock[] {
    if (status === 'live_facts_unavailable') {
      return [
        {
          type: 'message',
          text: 'Jag kan inte verifiera aktuellt pris, lager och produktstatus just nu, så jag visar ingen rekommendation ännu.',
        },
        {
          type: 'error_notice',
          code: 'product_live_facts_unavailable',
          text: 'Live produktfakta är inte tillgängliga just nu.',
          retryable: true,
        },
      ];
    }

    if (status === 'no_verified_candidates') {
      return [
        {
          type: 'message',
          text: 'Jag hittade ingen produkt som klarade den fulla kvalitetsgranskningen. Jag visar hellre inget än en svag rekommendation.',
        },
      ];
    }

    if (status === 'no_verified_live_products') {
      return [
        {
          type: 'message',
          text: 'Kandidaterna klarade produktanalysen, men ingen kunde verifieras som aktiv, synlig och köpbar just nu.',
        },
      ];
    }

    if (!productCardBlock) {
      throw new BadRequestException('verified_product_cards_required');
    }

    return [
      {
        type: 'message',
        text: productCardBlock.cards.length === 1
          ? 'Jag hittade en produkt som klarade både kvalitetsgranskningen och kontrollen av aktuellt pris, lager och produktstatus.'
          : `Jag hittade ${productCardBlock.cards.length} produkter som klarade både kvalitetsgranskningen och kontrollen av aktuellt pris, lager och produktstatus.`,
      },
      productCardBlock,
    ];
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
