import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AI_ARMAN_CHAT_CONTRACT_VERSION,
  AI_ARMAN_CONVERSATION_STATE_VERSION,
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
    const orderReference = detectOrderReference(normalized);
    const primaryIntent = detectIntent(normalized, requestedProductTypes, orderReference);
    const needs = detectNeeds(normalized);
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
      needs.includes('dry_hair_unspecified') &&
      !needs.includes('dry_lengths') &&
      !needs.includes('dry_scalp')
    ) {
      missingFields.push('drynessLocation');
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
      },
      missingFields,
      requiresIdentity,
      requiresHumanReview: primaryIntent === 'human_handoff',
    };
  }

  private decide(interpretation: AiArmanInterpretation): AiArmanDecision {
    switch (interpretation.primaryIntent) {
      case 'product_recommendation':
        return {
          owner: 'backend_policy',
          route: 'recommendation',
          plannedTools: interpretation.missingFields.length
            ? []
            : [
                'search_products',
                'analyze_product_suitability',
                'get_product_live_facts',
              ],
          executionStatus: 'not_executed_foundation',
          requiresIdentity: false,
          requiresConfirmation: false,
          reasons: interpretation.missingFields.length
            ? ['clarification_required_before_product_search']
            : ['recommendation_tool_chain_selected_by_backend'],
        };
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
    const question = buildQuestion(interpretationQuestionField(interpretation));
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
    const question = buildQuestion(interpretationQuestionField(interpretation));
    if (question) {
      return [
        {
          type: 'message',
          text: 'Jag behöver en liten detalj till innan jag kan gå vidare säkert.',
        },
        question,
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
  return [...new Set(matches)];
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

function detectNeeds(value: string) {
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
  ];
  for (const [pattern, label] of signals) {
    if (pattern.test(value)) needs.push(label);
  }
  return [...new Set(needs)];
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

function buildQuestion(field: string | null) {
  if (field === 'requestedProductType') {
    return {
      type: 'question' as const,
      id: 'requested-product-type',
      text: 'Vilken typ av hårprodukt söker du?',
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
