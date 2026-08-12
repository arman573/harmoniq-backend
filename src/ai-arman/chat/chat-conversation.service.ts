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
  AiArmanBeautyDomain,
  AiArmanChatRequest,
  AiArmanChatResponse,
  AiArmanConversationState,
  AiArmanDecision,
  AiArmanInterpretation,
  AiArmanProductCardBlock,
  AiArmanProductType,
  AiArmanResponseBlock,
  AiArmanRoutineTiming,
  AiArmanSkincareActive,
  AiArmanSkincareRoutineActive,
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

const HAIRCARE_PRODUCT_TYPES: AiArmanProductType[] = [
  'shampoo',
  'conditioner',
  'hair_mask',
  'leave_in',
];
const SKINCARE_NEEDS = [
  'dry_skin',
  'oily_skin',
  'sensitive_skin',
  'acne_prone_skin',
  'redness',
] as const;

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
    const contextualInterpretation = this.applyPendingAnswer(
      current.interpretation,
      previousState,
      input.message.text,
    );
    const interpretation = this.mergeInterpretation(
      contextualInterpretation,
      previousState,
      input.message.text,
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

  private applyPendingAnswer(
    current: AiArmanInterpretation,
    previous: AiArmanConversationState | null,
    messageText: string,
  ): AiArmanInterpretation {
    const expectedField = previous?.pendingQuestion?.expectedField;

    if (expectedField === 'requestedProductType') {
      const resolvedProductType = resolveRequestedProductTypeAnswer(messageText);
      if (!resolvedProductType) {
        return current;
      }

      return {
        ...current,
        entities: {
          ...current.entities,
          requestedProductTypes: unique([
            ...current.entities.requestedProductTypes,
            resolvedProductType,
          ]),
          recommendationDomain:
            current.entities.recommendationDomain ??
            productTypeDomain(resolvedProductType) ??
            previous?.remembered.recommendationDomain ??
            null,
        },
      };
    }

    if (expectedField === 'skincareConcern') {
      const resolvedNeeds = resolveSkincareConcernAnswer(messageText);
      if (resolvedNeeds.length === 0) return current;
      return {
        ...current,
        entities: {
          ...current.entities,
          needs: unique([...current.entities.needs, ...resolvedNeeds]),
          recommendationDomain:
            current.entities.recommendationDomain ??
            previous?.remembered.recommendationDomain ??
            'skincare',
        },
      };
    }

    if (expectedField !== 'drynessLocation') {
      return current;
    }

    const resolvedNeeds = resolveDrynessLocationAnswer(messageText);
    if (resolvedNeeds.length === 0) {
      return current;
    }

    return {
      ...current,
      entities: {
        ...current.entities,
        needs: unique([...current.entities.needs, ...resolvedNeeds]),
      },
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
      response.interpretation.entities.recommendationDomain === 'haircare' &&
      response.interpretation.entities.requestedProductTypes.every((type) =>
        HAIRCARE_PRODUCT_TYPES.includes(type),
      ) &&
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
    messageText: string,
  ): AiArmanInterpretation {
    const previousDomain = previous?.remembered.recommendationDomain ?? null;
    const explicitCurrentDomain = current.entities.recommendationDomain ?? null;
    const domainSwitched = Boolean(
      previousDomain &&
        explicitCurrentDomain &&
        previousDomain !== explicitCurrentDomain,
    );
    const previousRequestedProductTypes = domainSwitched
      ? []
      : previous?.remembered.requestedProductTypes ?? [];
    const previousNeeds = domainSwitched
      ? []
      : previous?.remembered.needs ?? [];
    const previousExclusions = domainSwitched
      ? []
      : previous?.remembered.exclusions ?? [];
    const previousProductReferences = domainSwitched
      ? []
      : previous?.remembered.productReferences ?? [];
    const previousSkincareRoutineActives = domainSwitched
      ? []
      : previous?.remembered.skincareRoutineActives ?? [];

    const requestedProductTypes = unique([
      ...previousRequestedProductTypes,
      ...current.entities.requestedProductTypes,
    ]);
    const needs = normalizeMergedNeeds([
      ...previousNeeds,
      ...current.entities.needs,
    ]);
    const exclusions = unique([
      ...previousExclusions,
      ...current.entities.exclusions,
    ]);
    const productReferences = unique([
      ...previousProductReferences,
      ...current.entities.productReferences,
    ]);
    const orderReference =
      current.entities.orderReference ??
      previous?.remembered.orderReference ??
      null;
    const recommendationDomain =
      explicitCurrentDomain ??
      previousDomain ??
      inferDomainFromProductTypes(requestedProductTypes);
    const contextualSkincareActives =
      recommendationDomain === 'skincare'
        ? detectSkincareRoutineActives(normalizeFollowUpText(messageText))
        : [];
    const skincareRoutineActives =
      recommendationDomain === 'skincare'
        ? mergeSkincareRoutineActives([
            ...previousSkincareRoutineActives,
            ...(current.entities.skincareRoutineActives ?? []),
            ...contextualSkincareActives,
          ])
        : [];

    const productJourneyContinues =
      previous?.activeJourney === 'before_purchase' ||
      previous?.pendingQuestion?.expectedField === 'requestedProductType' ||
      previous?.pendingQuestion?.expectedField === 'drynessLocation' ||
      previous?.pendingQuestion?.expectedField === 'skincareConcern' ||
      current.primaryIntent === 'product_recommendation' ||
      (current.primaryIntent === 'unknown' && needs.length > 0);

    const primaryIntent = productJourneyContinues
      ? 'product_recommendation'
      : current.primaryIntent;
    const missingFields = current.missingFields.filter(
      (field) =>
        field !== 'requestedProductType' &&
        field !== 'drynessLocation' &&
        field !== 'skincareConcern',
    );

    if (
      primaryIntent === 'product_recommendation' &&
      requestedProductTypes.length === 0
    ) {
      missingFields.push('requestedProductType');
    }
    if (
      primaryIntent === 'product_recommendation' &&
      recommendationDomain === 'haircare' &&
      needs.includes('dry_hair_unspecified') &&
      !needs.includes('dry_lengths') &&
      !needs.includes('dry_scalp')
    ) {
      missingFields.push('drynessLocation');
    }
    if (
      primaryIntent === 'product_recommendation' &&
      recommendationDomain === 'skincare' &&
      !hasSkincareNeed(needs)
    ) {
      missingFields.push('skincareConcern');
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
        recommendationDomain,
        skincareRoutineActives,
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

    const haircareReady =
      interpretation.entities.recommendationDomain === 'haircare' &&
      interpretation.entities.requestedProductTypes.every((type) =>
        HAIRCARE_PRODUCT_TYPES.includes(type),
      );
    const ready = interpretation.missingFields.length === 0 && haircareReady;
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
      reasons: interpretation.missingFields.length
        ? ['clarification_required_before_product_search']
        : haircareReady
          ? ['multi_turn_need_profile_ready_for_backend_tools']
          : ['specialist_domain_not_enabled_for_tools'],
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
      : interpretation.missingFields.includes('drynessLocation')
        ? {
            id: 'dryness-location',
            expectedField: 'drynessLocation',
          }
        : interpretation.missingFields.includes('skincareConcern')
          ? {
              id: 'skincare-concern',
              expectedField: 'skincareConcern',
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
        recommendationDomain:
          interpretation.entities.recommendationDomain ?? null,
        skincareRoutineActives:
          interpretation.entities.skincareRoutineActives ?? [],
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
      const haircare = interpretation.entities.recommendationDomain === 'haircare';
      return [
        {
          type: 'message',
          text: haircare
            ? 'Jag har sparat det du berättat om håret. Jag behöver bara veta vilken typ av produkt du söker.'
            : 'Jag har sparat produktområdet. Jag behöver bara veta vilken typ av produkt du söker.',
        },
        {
          type: 'question',
          id: 'requested-product-type',
          text: haircare
            ? 'Söker du schampo, balsam, hårinpackning eller leave-in?'
            : 'Vilken typ av produkt söker du?',
          expectedField: 'requestedProductType',
          required: true,
        },
      ];
    }

    if (interpretation.missingFields.includes('drynessLocation')) {
      return [
        {
          type: 'message',
          text: 'Jag har sparat att håret känns torrt. En detalj hjälper mig att välja säkrare.',
        },
        {
          type: 'question',
          id: 'dryness-location',
          text: 'Känns torrheten främst i hårbotten, i längderna eller både och?',
          expectedField: 'drynessLocation',
          required: true,
        },
      ];
    }

    if (interpretation.missingFields.includes('skincareConcern')) {
      return [
        {
          type: 'message',
          text: 'Jag har sparat att du söker hudvård. En detalj behövs innan jag kan bedöma vad som passar.',
        },
        {
          type: 'question',
          id: 'skincare-concern',
          text: 'Vad vill du främst få hjälp med i huden – till exempel torrhet, blank/fet hud, känslighet/rodnad eller finnar?',
          expectedField: 'skincareConcern',
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

function resolveRequestedProductTypeAnswer(
  value: string,
): AiArmanProductType | null {
  const normalized = normalizeFollowUpText(value);
  if (!normalized) return null;

  if (
    /\bleave[ -]?in\b/.test(normalized) ||
    /\butan att sk[oö]lja ur\b/.test(normalized) ||
    /\binte (?:behover )?sk[oö]lja ur\b/.test(normalized) ||
    /\binte (?:behover )?sk[oö]ljas ur\b/.test(normalized) ||
    /\bfar sitta kvar\b/.test(normalized) ||
    /\bska sitta kvar\b/.test(normalized) ||
    /\blamna kvar\b/.test(normalized)
  ) {
    return 'leave_in';
  }
  if (/\bharmask\b|\bharinpackning\b|\binpackning\b|\bhair mask\b/.test(normalized)) {
    return 'hair_mask';
  }
  if (/\bschampo\b|\bshampoo\b/.test(normalized)) return 'shampoo';
  if (/\bbalsam\b|\bconditioner\b/.test(normalized)) return 'conditioner';

  if (/\bansiktsrengoring\b|\brengoringsgel\b|\brengoringsolja\b|\bcleanser\b/.test(normalized)) return 'cleanser';
  if (/\bansiktskram\b|\bdagkram\b|\bnattkram\b|\bface cream\b|\bmoisturizer\b/.test(normalized)) return 'face_cream';
  if (/\bserum\b/.test(normalized)) return 'serum';
  if (/\bspf\b|\bsolskydd\b|\bsolkram\b/.test(normalized)) return 'spf';
  if (/\bparfym\b|\beau de parfum\b|\beau de toilette\b|\bedp\b|\bedt\b/.test(normalized)) return 'fragrance';
  if (/\bfoundation\b/.test(normalized)) return 'foundation';
  if (/\bconcealer\b/.test(normalized)) return 'concealer';
  if (/\blappstift\b|\blipstick\b/.test(normalized)) return 'lipstick';
  if (/\bmascara\b/.test(normalized)) return 'mascara';
  if (/\bnagellack\b|\bnail polish\b/.test(normalized)) return 'nail_polish';
  if (/\bbaslack\b|\bbase coat\b/.test(normalized)) return 'base_coat';
  if (/\btopplack\b|\btop coat\b/.test(normalized)) return 'top_coat';
  if (/\bnagelbehandling\b|\bnail treatment\b|\bnagelstarkare\b/.test(normalized)) return 'nail_treatment';
  return null;
}

function resolveDrynessLocationAnswer(value: string): string[] {
  const normalized = normalizeFollowUpText(value);
  if (!normalized) return [];

  const mentionsScalp = /\bharbotten\b/.test(normalized);
  const mentionsLengths = /\b(?:langderna|langder|langden|topparna|toppar)\b/.test(
    normalized,
  );
  const negatesScalp = /\binte\s+(?:i\s+)?harbotten\b/.test(normalized);
  const negatesLengths = /\binte\s+(?:i\s+)?(?:langderna|langder|topparna|toppar)\b/.test(
    normalized,
  );
  const explicitBoth = /\b(?:bada|bade|bagge)(?:\s+och)?\b/.test(normalized);

  if (negatesScalp && mentionsLengths) return ['dry_lengths'];
  if (negatesLengths && mentionsScalp) return ['dry_scalp'];
  if (explicitBoth || (mentionsScalp && mentionsLengths)) {
    return ['dry_scalp', 'dry_lengths'];
  }
  if (mentionsScalp) return ['dry_scalp'];
  if (mentionsLengths) return ['dry_lengths'];
  return [];
}

function resolveSkincareConcernAnswer(value: string): string[] {
  const normalized = normalizeFollowUpText(value);
  if (!normalized) return [];
  const needs: string[] = [];
  const signals: Array<[RegExp, string]> = [
    [/torr hud|torr i ansiktet|huden ar torr|\btorr\b|stram hud|stramar/, 'dry_skin'],
    [/fet hud|oljig hud|blank hud|\bfet\b|\boljig\b|\bblank\b/, 'oily_skin'],
    [/kanslig hud|lattirriterad hud|irriterad hud|\bkanslig\b|svider latt/, 'sensitive_skin'],
    [/\bakne\b|finnar|oren hud|blemish/, 'acne_prone_skin'],
    [/rodnad|rod hud|\brod\b|rosig hud/, 'redness'],
  ];
  for (const [pattern, need] of signals) {
    if (pattern.test(normalized)) needs.push(need);
  }
  return unique(needs);
}

function detectSkincareRoutineActives(
  value: string,
): AiArmanSkincareRoutineActive[] {
  const signals: Array<[RegExp, AiArmanSkincareActive]> = [
    [/\bretinol\b|\bretinal\b|\bretinoid\b|\btretinoin\b/, 'retinoid'],
    [/\baha\b|glykolsyra|mjolksyra|glycolic acid|lactic acid/, 'aha'],
    [/\bbha\b|salicylsyra|salicylic acid/, 'bha'],
    [/\bpha\b|gluconolactone/, 'pha'],
    [/vitamin c|askorbinsyra|ascorbic acid/, 'vitamin_c'],
    [/niacinamid|niacinamide/, 'niacinamide'],
    [/azelainsyra|azelaic acid/, 'azelaic_acid'],
    [/bensoylperoxid|benzoyl peroxide/, 'benzoyl_peroxide'],
  ];
  const actives = signals
    .flatMap(([pattern, active]) => {
      const match = value.match(pattern);
      return match?.index === undefined ? [] : [{ active, index: match.index }];
    })
    .sort((left, right) => left.index - right.index);
  if (actives.length === 0) return [];

  const timings = findRoutineTimingOccurrences(value);
  if (timings.length === 0) {
    return actives.map(({ active }) => ({ active, timing: 'unspecified' }));
  }

  const messageTimings = unique(timings.map((item) => item.timing));
  if (messageTimings.length === 1) {
    return actives.map(({ active }) => ({ active, timing: messageTimings[0] }));
  }

  return actives.map((item, index) => {
    const previous = actives[index - 1];
    const next = actives[index + 1];
    const leftBoundary = previous
      ? previous.index + Math.floor((item.index - previous.index) / 2)
      : 0;
    const rightBoundary = next
      ? item.index + Math.floor((next.index - item.index) / 2)
      : value.length;
    const localTimings = unique(
      timings
        .filter(
          (timing) =>
            timing.index >= leftBoundary && timing.index < rightBoundary,
        )
        .map((timing) => timing.timing),
    );

    return {
      active: item.active,
      timing: localTimings.length === 1 ? localTimings[0] : 'unspecified',
    };
  });
}

function findRoutineTimingOccurrences(value: string): Array<{
  timing: Exclude<AiArmanRoutineTiming, 'unspecified'>;
  index: number;
}> {
  const signals: Array<{
    pattern: RegExp;
    timing: Exclude<AiArmanRoutineTiming, 'unspecified'>;
  }> = [
    { pattern: /\bmorgon\b|\bpa morgonen\b|\bdagtid\b/g, timing: 'morning' },
    { pattern: /\bkvall\b|\bpa kvallen\b|\bnattetid\b/g, timing: 'evening' },
  ];
  const result: Array<{
    timing: Exclude<AiArmanRoutineTiming, 'unspecified'>;
    index: number;
  }> = [];

  for (const { pattern, timing } of signals) {
    pattern.lastIndex = 0;
    for (const match of value.matchAll(pattern)) {
      if (match.index === undefined) continue;
      result.push({ timing, index: match.index });
    }
  }
  return result.sort((left, right) => left.index - right.index);
}

function mergeSkincareRoutineActives(
  values: AiArmanSkincareRoutineActive[],
): AiArmanSkincareRoutineActive[] {
  const byActive = new Map<AiArmanSkincareActive, AiArmanSkincareRoutineActive>();
  for (const item of values) {
    const existing = byActive.get(item.active);
    if (!existing || existing.timing === 'unspecified' || item.timing !== 'unspecified') {
      byActive.set(item.active, item);
    }
  }
  return [...byActive.values()];
}

function normalizeFollowUpText(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeMergedNeeds(values: string[]): string[] {
  const needs = unique(values);
  if (needs.includes('dry_lengths') || needs.includes('dry_scalp')) {
    return needs.filter((need) => need !== 'dry_hair_unspecified');
  }
  return needs;
}

function hasSkincareNeed(needs: string[]) {
  return needs.some((need) =>
    SKINCARE_NEEDS.includes(need as (typeof SKINCARE_NEEDS)[number]),
  );
}

function inferDomainFromProductTypes(
  productTypes: AiArmanProductType[],
): AiArmanBeautyDomain | null {
  const domains = unique(
    productTypes
      .map(productTypeDomain)
      .filter((domain): domain is AiArmanBeautyDomain => Boolean(domain)),
  );
  return domains.length === 1 ? domains[0] : null;
}

function productTypeDomain(type: AiArmanProductType): AiArmanBeautyDomain | null {
  if (HAIRCARE_PRODUCT_TYPES.includes(type)) return 'haircare';
  if (['cleanser', 'face_cream', 'serum', 'spf'].includes(type)) return 'skincare';
  if (type === 'fragrance') return 'fragrance';
  if (['foundation', 'concealer', 'lipstick', 'mascara'].includes(type)) return 'makeup';
  if (['nail_polish', 'base_coat', 'top_coat', 'nail_treatment'].includes(type)) return 'nails';
  return null;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function isSupportedProductType(
  value: string,
): value is AiArmanProductType {
  return [
    'shampoo',
    'conditioner',
    'hair_mask',
    'leave_in',
    'cleanser',
    'face_cream',
    'serum',
    'spf',
    'fragrance',
    'foundation',
    'concealer',
    'lipstick',
    'mascara',
    'nail_polish',
    'base_coat',
    'top_coat',
    'nail_treatment',
  ].includes(value);
}
