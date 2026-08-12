import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AI_ARMAN_CHAT_CONTRACT_VERSION,
  AI_ARMAN_CONVERSATION_STATE_VERSION,
  AiArmanBeautyDomain,
  AiArmanChatRequest,
  AiArmanChatResponse,
  AiArmanConversationState,
  AiArmanDecision,
  AiArmanIntent,
  AiArmanInterpretation,
  AiArmanJourney,
  AiArmanProductType,
  AiArmanResponseBlock,
} from './chat-messages.types';

const MAX_MESSAGE_LENGTH = 2000;
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
export class ChatMessagesService {
  handle(input: AiArmanChatRequest): AiArmanChatResponse {
    this.validateRequest(input);

    const text = input.message.text.trim();
    const normalized = normalizeText(text);
    const conversationId =
      input.conversationId?.trim() || this.createOpaqueId('conversation');
    const interpretation = this.interpret(normalized);
    const decision = this.decide(interpretation);
    const state = this.buildState(conversationId, interpretation, decision);
    const blocks = this.composeBlocks(interpretation, decision);

    return {
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      conversationId,
      serverMessageId: this.createOpaqueId('message'),
      interpretation,
      state,
      decision,
      blocks,
      safety: {
        aiModelUsed: false,
        liveFactsUsed: false,
        writesExecuted: false,
        productionActionsEnabled: false,
        htmlAcceptedFromModel: false,
      },
    };
  }

  private validateRequest(input: AiArmanChatRequest) {
    if (!input || input.contractVersion !== AI_ARMAN_CHAT_CONTRACT_VERSION) {
      throw new BadRequestException('unsupported_chat_contract_version');
    }

    if (!input.clientMessageId?.trim()) {
      throw new BadRequestException('client_message_id_required');
    }

    const text = input.message?.text;
    if (typeof text !== 'string' || !text.trim()) {
      throw new BadRequestException('message_text_required');
    }

    if (text.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException('message_text_too_long');
    }

    const body = input as unknown as Record<string, unknown>;
    const forbiddenFields = [
      'candidates',
      'scores',
      'conversationState',
      'plannedTools',
      'toolChoice',
      'customerId',
    ];
    const forbiddenField = forbiddenFields.find((field) => field in body);
    if (forbiddenField) {
      throw new BadRequestException(`browser_owned_field_rejected:${forbiddenField}`);
    }
  }

  private interpret(normalized: string): AiArmanInterpretation {
    const requestedProductTypes = detectProductTypes(normalized);
    const recommendationDomain = detectBeautyDomain(normalized, requestedProductTypes);
    const orderReference = detectOrderReference(normalized);
    const primaryIntent = detectIntent(normalized, requestedProductTypes, orderReference);
    const needs = detectNeeds(normalized, recommendationDomain);
    const requiresIdentity = [
      'order_status',
      'tracking_status',
      'return_help',
      'claim_help',
      'purchased_product_usage',
    ].includes(primaryIntent);

    const missingFields: string[] = [];
    if (primaryIntent === 'product_recommendation' && requestedProductTypes.length === 0) {
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
    if (
      ['order_status', 'tracking_status', 'return_help', 'claim_help'].includes(primaryIntent) &&
      !orderReference
    ) {
      missingFields.push('verifiedOrderIdentity');
    }

    return {
      schemaVersion: 'ai-arman-interpretation-v1',
      source: 'deterministic_fallback',
      locale: 'sv-SE',
      primaryIntent,
      secondaryIntents: [],
      confidence: primaryIntent === 'unknown' ? 0.35 : 0.72,
      entities: {
        requestedProductTypes,
        needs,
        exclusions: detectExclusions(normalized),
        orderReference,
        productReferences: [],
        recommendationDomain,
      },
      missingFields,
      requiresIdentity,
      requiresHumanReview: primaryIntent === 'human_handoff',
    };
  }

  private decide(interpretation: AiArmanInterpretation): AiArmanDecision {
    switch (interpretation.primaryIntent) {
      case 'product_recommendation': {
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
              ? ['recommendation_tool_chain_selected_by_backend']
              : ['specialist_domain_not_enabled_for_tools'],
        };
      }
      case 'purchased_product_usage':
        return this.foundationDecision(
          'purchased_product_guidance',
          true,
          ['verified_order_and_product_context_required'],
        );
      case 'order_status':
        return this.foundationDecision('order_support', true, [
          'verified_identity_required_before_get_order',
        ]);
      case 'tracking_status':
        return this.foundationDecision('order_support', true, [
          'verified_identity_required_before_get_tracking_status',
        ]);
      case 'return_help':
      case 'claim_help':
        return this.foundationDecision('returns_support', true, [
          'verified_identity_required_before_case_preparation',
          'writes_remain_disabled',
        ]);
      case 'human_handoff':
        return {
          owner: 'backend_policy',
          route: 'human_support',
          plannedTools: ['handoff_to_customer_service'],
          executionStatus: 'not_executed_foundation',
          requiresIdentity: false,
          requiresConfirmation: false,
          reasons: ['human_handoff_requested', 'integration_not_executed_in_foundation'],
        };
      default:
        return this.foundationDecision('general', false, [
          'safe_general_response_without_tool_execution',
        ]);
    }
  }

  private foundationDecision(
    route: AiArmanDecision['route'],
    requiresIdentity: boolean,
    reasons: string[],
  ): AiArmanDecision {
    return {
      owner: 'backend_policy',
      route,
      plannedTools: [],
      executionStatus: 'not_executed_foundation',
      requiresIdentity,
      requiresConfirmation: false,
      reasons,
    };
  }

  private buildState(
    conversationId: string,
    interpretation: AiArmanInterpretation,
    decision: AiArmanDecision,
  ): AiArmanConversationState {
    const question = buildQuestion(
      interpretationQuestionField(interpretation),
      interpretation.entities.recommendationDomain ?? null,
    );
    return {
      stateVersion: AI_ARMAN_CONVERSATION_STATE_VERSION,
      conversationId,
      status:
        decision.route === 'human_support'
          ? 'handoff_required'
          : question
            ? 'collecting'
            : 'ready_for_tools',
      activeJourney: journeyForIntent(interpretation.primaryIntent),
      locale: 'sv-SE',
      identityLevel: 'anonymous',
      remembered: interpretation.entities,
      pendingQuestion: question
        ? { id: question.id, expectedField: question.expectedField }
        : null,
    };
  }

  private composeBlocks(
    interpretation: AiArmanInterpretation,
    decision: AiArmanDecision,
  ): AiArmanResponseBlock[] {
    const question = buildQuestion(
      interpretationQuestionField(interpretation),
      interpretation.entities.recommendationDomain ?? null,
    );
    if (question) {
      return [
        {
          type: 'message',
          text: 'Jag behöver en liten detalj till innan jag kan gå vidare säkert.',
        },
        question,
      ];
    }

    if (
      decision.route === 'recommendation' &&
      decision.reasons.includes('specialist_domain_not_enabled_for_tools')
    ) {
      return [
        {
          type: 'message',
          text: `Jag har förstått att frågan gäller ${domainLabel(interpretation.entities.recommendationDomain ?? null)}. Området är identifierat, men specialistmotorn får ännu inte köra produktverktyg förrän dess egna kvalitetsregler är verifierade.`,
        },
      ];
    }

    if (decision.route === 'recommendation') {
      return [
        {
          type: 'message',
          text: 'Jag har förstått behovet. Nästa steg är att låta backend hitta och kvalitetsgranska kandidater innan något rekommenderas.',
        },
      ];
    }

    if (decision.route === 'order_support' || decision.route === 'returns_support') {
      return [
        {
          type: 'message',
          text: 'Jag kan hjälpa med detta när ordern har verifierats genom det godkända backendflödet. Ingen orderinformation har hämtats ännu.',
        },
      ];
    }

    if (decision.route === 'human_support') {
      return [
        {
          type: 'message',
          text: 'Jag kan förbereda en överlämning till kundservice med sammanhanget bevarat.',
        },
        {
          type: 'support_handoff',
          status: 'not_configured',
          reason: 'foundation_only',
          transcriptPreserved: true,
        },
      ];
    }

    return [
      {
        type: 'message',
        text: 'Hej! Skriv gärna vad du vill ha hjälp med—produktval, en köpt produkt, order eller retur.',
      },
      {
        type: 'quick_replies',
        options: [
          { id: 'choose-product', label: 'Hjälp mig välja produkt', value: 'Jag vill ha hjälp att välja produkt' },
          { id: 'find-order', label: 'Var är min beställning?', value: 'Var är min beställning?' },
          { id: 'bought-product', label: 'Hjälp med en köpt produkt', value: 'Jag behöver hjälp med en produkt jag köpt' },
        ],
      },
    ];
  }

  private createOpaqueId(prefix: 'conversation' | 'message') {
    return `${prefix}-${randomUUID()}`;
  }
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s#-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectProductTypes(value: string): AiArmanProductType[] {
  const matches: AiArmanProductType[] = [];
  if (value.includes('schampo') || value.includes('shampoo')) matches.push('shampoo');
  if (value.includes('balsam') || value.includes('conditioner')) matches.push('conditioner');
  if (value.includes('harinpackning') || value.includes('inpackning') || value.includes('hair mask')) {
    matches.push('hair_mask');
  }
  if (value.includes('leave in') || value.includes('leave-in')) matches.push('leave_in');

  if (/ansiktsrengoring|rengoringsgel|rengoringsolja|cleanser/.test(value)) matches.push('cleanser');
  if (/ansiktskram|dagkram|nattkram|face cream|moisturizer/.test(value)) matches.push('face_cream');
  if (/\bserum\b/.test(value)) matches.push('serum');
  if (/\bspf\b|solskydd|solkram/.test(value)) matches.push('spf');

  const fragranceAvoidance = /parfymfri|parfymfritt|utan parfym|ingen parfym|oparfymerad|oparfymerat/.test(value);
  if (!fragranceAvoidance && /\bparfym\b|eau de parfum|eau de toilette|\bedp\b|\bedt\b/.test(value)) {
    matches.push('fragrance');
  }

  if (/\bfoundation\b/.test(value)) matches.push('foundation');
  if (/\bconcealer\b/.test(value)) matches.push('concealer');
  if (/lappstift|lipstick/.test(value)) matches.push('lipstick');
  if (/\bmascara\b/.test(value)) matches.push('mascara');

  if (/nagellack|nail polish/.test(value)) matches.push('nail_polish');
  if (/baslack|base coat/.test(value)) matches.push('base_coat');
  if (/topplack|top coat/.test(value)) matches.push('top_coat');
  if (/nagelbehandling|nail treatment|nagelstarkare/.test(value)) matches.push('nail_treatment');

  return [...new Set(matches)];
}

function detectBeautyDomain(
  value: string,
  productTypes: AiArmanProductType[],
): AiArmanBeautyDomain | null {
  const typeDomains = unique(
    productTypes.map(productTypeDomain).filter((domain): domain is AiArmanBeautyDomain => Boolean(domain)),
  );
  if (typeDomains.length === 1) return typeDomains[0];
  if (typeDomains.length > 1) return null;

  if (/harbotten|\bhar\b|harvard|harprodukt/.test(value)) return 'haircare';
  if (/hudvard|ansikte|ansiktet|hudtyp|hudbarriar|finnar|akne/.test(value)) return 'skincare';
  if (/makeup|smink|undertone|underton|tackning/.test(value)) return 'makeup';
  if (/nagel|naglar/.test(value)) return 'nails';
  if (!/utan parfym|parfymfri|parfymfritt/.test(value) && /parfym|doftfamilj|doftnot/.test(value)) {
    return 'fragrance';
  }
  return null;
}

function productTypeDomain(type: AiArmanProductType): AiArmanBeautyDomain | null {
  if (HAIRCARE_PRODUCT_TYPES.includes(type)) return 'haircare';
  if (['cleanser', 'face_cream', 'serum', 'spf'].includes(type)) return 'skincare';
  if (type === 'fragrance') return 'fragrance';
  if (['foundation', 'concealer', 'lipstick', 'mascara'].includes(type)) return 'makeup';
  if (['nail_polish', 'base_coat', 'top_coat', 'nail_treatment'].includes(type)) return 'nails';
  return null;
}

function detectOrderReference(value: string) {
  const match = value.match(/(?:order|bestallning|ordernummer)\s*#?\s*(\d{4,})/);
  return match?.[1] ?? null;
}

function detectIntent(
  value: string,
  productTypes: AiArmanProductType[],
  orderReference: string | null,
): AiArmanIntent {
  if (/kundtjanst|manniska|person|support/.test(value)) return 'human_handoff';
  if (/reklamation|fel produkt|skadad produkt/.test(value)) return 'claim_help';
  if (/retur|returnera|angra kop/.test(value)) return 'return_help';
  if (/sparning|tracking|paket|leverans/.test(value)) return 'tracking_status';
  if (/var ar min bestallning|orderstatus/.test(value) || orderReference) return 'order_status';
  if (/kopte|kopt|anvanda|anvander|hur ofta/.test(value)) return 'purchased_product_usage';
  if (productTypes.length > 0 || /passar|rekommendera|vilken produkt|produktval/.test(value)) {
    return 'product_recommendation';
  }
  if (/^hej$|^hejsan$|^hallo$|^hello$/.test(value)) return 'greeting';
  return 'unknown';
}

function detectNeeds(value: string, domain: AiArmanBeautyDomain | null) {
  const needs: string[] = [];
  const dryLengths = /torra langder|torra toppar|framst langderna|mest langderna|langderna(?: ar)? torra/.test(value);
  const dryScalp = /torr harbotten|torr i harbotten|harbotten(?: ar)? torr|framst harbotten|mest harbotten/.test(value);

  if (dryLengths) needs.push('dry_lengths');
  if (dryScalp) needs.push('dry_scalp');
  if (
    !dryLengths &&
    !dryScalp &&
    /\btorr(?:t|a)?\b/.test(value) &&
    /\bhar\b/.test(value)
  ) {
    needs.push('dry_hair_unspecified');
  }
  if (/\bblekt\b|\bblekta\b|\bblonderat\b|\bblonderade\b|\bblekning\b|\bslingat\b/.test(value)) {
    needs.push('bleached_hair');
  }

  const signals: Array<[RegExp, string]> = [
    [/\btunt\b|\bfint(?:\s+[a-z0-9-]+){0,3}\s+har\b|\btunna stran\b|\bfina stran\b/, 'thin_hair'],
    [/\bfargat\b|\bfargbehandlat\b|\bfargbehandlade\b/, 'color_treated_hair'],
    [/fett snabbt|fet harbotten|\boljig(?:\s+[a-z0-9-]+){0,3}\s+harbotten\b|\bflottig(?:\s+[a-z0-9-]+){0,3}\s+harbotten\b/, 'oily_scalp'],
    [/skadat har|\bslitet(?:\s+[a-z0-9-]+){0,3}\s+har\b|skora langder|skort har|kemiskt skadat|varmeskadat/, 'damaged_hair'],
    [/friss|frizz/, 'frizz_control'],
    [/kanslig harbotten|irriterad harbotten|lattirriterad harbotten|harbotten blir latt irriterad/, 'sensitive_scalp'],
    [/latt formula|latt produkt|tynger inte ner|inte tynger ner|inte tynga ner|utan att tynga ner|plattar inte till|inte plattar till|\bviktlos\b|\bweightless\b|\blightweight\b/, 'lightweight_haircare'],
    [/torr hud|torr i ansiktet|huden ar torr|stram hud|huden stramar/, 'dry_skin'],
    [/fet hud|oljig hud|blank hud|huden blir blank|blank i ansiktet/, 'oily_skin'],
    [/kanslig hud|lattirriterad hud|irriterad hud|huden svider latt/, 'sensitive_skin'],
    [/\bakne\b|finnar|oren hud|blemish/, 'acne_prone_skin'],
    [/rodnad|rod hud|huden blir rod|rosig hud/, 'redness'],
  ];
  for (const [pattern, label] of signals) {
    if (pattern.test(value)) needs.push(label);
  }

  if (domain === 'skincare') {
    if (/\btorr(?:t|a)?\b|\bstram(?:t|a)?\b/.test(value)) needs.push('dry_skin');
    if (/\bfet(?:t|a)?\b|\boljig(?:t|a)?\b|\bblank(?:t|a)?\b/.test(value)) needs.push('oily_skin');
    if (/\bkanslig(?:t|a)?\b|\birriterad(?:e)?\b|\bsvider\b/.test(value)) needs.push('sensitive_skin');
    if (/\bakne\b|\bfinnar\b|\bblemish(?:es)?\b/.test(value)) needs.push('acne_prone_skin');
    if (/\brodnad\b|\brod(?:a|t)?\b|\brosig(?:t|a)?\b/.test(value)) needs.push('redness');
  }

  return [...new Set(needs)];
}

function hasSkincareNeed(needs: string[]) {
  return needs.some((need) => SKINCARE_NEEDS.includes(need as (typeof SKINCARE_NEEDS)[number]));
}

function detectExclusions(value: string) {
  const exclusions: string[] = [];
  if (
    /parfymfri|parfymfritt|utan parfym|ingen parfym|oparfymerad|oparfymerat/.test(
      value,
    )
  ) {
    exclusions.push('fragrance');
  }
  if (
    /silikonfri|silikonfritt|utan silikon|utan silikoner|inga silikoner/.test(
      value,
    )
  ) {
    exclusions.push('silicones');
  }
  if (
    /proteinfri|proteinfritt|utan protein|utan proteiner|inga proteiner/.test(
      value,
    )
  ) {
    exclusions.push('proteins');
  }
  return exclusions;
}

function journeyForIntent(intent: AiArmanIntent): AiArmanJourney {
  if (intent === 'product_recommendation') return 'before_purchase';
  if (['purchased_product_usage', 'order_status', 'tracking_status'].includes(intent)) {
    return 'after_purchase';
  }
  if (['return_help', 'claim_help', 'human_handoff'].includes(intent)) {
    return 'customer_service';
  }
  return 'general';
}

function interpretationQuestionField(interpretation: AiArmanInterpretation) {
  return interpretation.missingFields[0] ?? null;
}

function buildQuestion(field: string | null, domain: AiArmanBeautyDomain | null) {
  if (field === 'requestedProductType') {
    return {
      type: 'question' as const,
      id: 'requested-product-type',
      text: domain === 'haircare'
        ? 'Vilken typ av hårprodukt söker du?'
        : 'Vilken typ av produkt söker du?',
      expectedField: field,
      required: true,
    };
  }
  if (field === 'drynessLocation') {
    return {
      type: 'question' as const,
      id: 'dryness-location',
      text: 'Känns torrheten främst i hårbotten, i längderna eller både och?',
      expectedField: field,
      required: true,
    };
  }
  if (field === 'skincareConcern') {
    return {
      type: 'question' as const,
      id: 'skincare-concern',
      text: 'Vad vill du främst få hjälp med i huden – till exempel torrhet, blank/fet hud, känslighet/rodnad eller finnar?',
      expectedField: field,
      required: true,
    };
  }
  if (field === 'verifiedOrderIdentity') {
    return {
      type: 'question' as const,
      id: 'verified-order-identity',
      text: 'För att läsa ordern behöver vi först verifiera den säkert.',
      expectedField: field,
      required: true,
    };
  }
  return null;
}

function domainLabel(domain: AiArmanBeautyDomain | null) {
  switch (domain) {
    case 'haircare':
      return 'hårvård';
    case 'skincare':
      return 'hudvård';
    case 'fragrance':
      return 'parfym';
    case 'makeup':
      return 'makeup';
    case 'nails':
      return 'naglar';
    default:
      return 'produktområdet';
  }
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
