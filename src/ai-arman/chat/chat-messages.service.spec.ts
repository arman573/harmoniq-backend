import { BadRequestException } from '@nestjs/common';
import { ChatMessagesService } from './chat-messages.service';
import { AI_ARMAN_CHAT_CONTRACT_VERSION } from './chat-messages.types';

describe('ChatMessagesService', () => {
  const service = new ChatMessagesService();

  it('interprets complex Swedish haircare free text without accepting candidates from the browser', () => {
    const result = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'client-1',
      message: {
        text: 'Jag har tunt och färgat hår som blir fett snabbt men torra längder. Vilket schampo passar?',
      },
      context: { locale: 'sv-SE', channel: 'web_widget' },
    });

    expect(result.interpretation.primaryIntent).toBe('product_recommendation');
    expect(result.interpretation.entities.recommendationDomain).toBe('haircare');
    expect(result.interpretation.entities.requestedProductTypes).toEqual(['shampoo']);
    expect(result.interpretation.entities.needs).toEqual(
      expect.arrayContaining(['thin_hair', 'color_treated_hair', 'oily_scalp', 'dry_lengths']),
    );
    expect(result.decision.owner).toBe('backend_policy');
    expect(result.decision.plannedTools).toEqual([
      'search_products',
      'analyze_product_suitability',
      'get_product_live_facts',
    ]);
    expect(result.safety.liveFactsUsed).toBe(false);
    expect(result.safety.productionActionsEnabled).toBe(false);
  });

  it('recognizes common Swedish descriptions of hair concerns without unnecessary clarification', () => {
    const result = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'broader-hair-language-1',
      message: {
        text: 'Jag har fint slitet och frissigt hår, oljig och lättirriterad hårbotten och söker balsam.',
      },
    });

    expect(result.interpretation.primaryIntent).toBe('product_recommendation');
    expect(result.interpretation.entities.requestedProductTypes).toEqual(['conditioner']);
    expect(result.interpretation.entities.needs).toEqual(
      expect.arrayContaining([
        'thin_hair',
        'damaged_hair',
        'frizz_control',
        'oily_scalp',
        'sensitive_scalp',
      ]),
    );
    expect(result.interpretation.missingFields).toEqual([]);
    expect(result.state.status).toBe('ready_for_tools');
    expect(result.decision.plannedTools).toEqual([
      'search_products',
      'analyze_product_suitability',
      'get_product_live_facts',
    ]);
  });

  it('recognizes broader Swedish bleaching and color-treatment wording', () => {
    const result = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'broader-treatment-language-1',
      message: {
        text: 'Mitt hår är färgbehandlat och slingat och jag söker en hårinpackning.',
      },
    });

    expect(result.interpretation.primaryIntent).toBe('product_recommendation');
    expect(result.interpretation.entities.requestedProductTypes).toEqual(['hair_mask']);
    expect(result.interpretation.entities.needs).toEqual(
      expect.arrayContaining(['color_treated_hair', 'bleached_hair']),
    );
    expect(result.interpretation.missingFields).toEqual([]);
  });

  it('preserves bleached hair and asks where unspecified dryness is located before product search', () => {
    const result = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'dryness-clarification-1',
      message: {
        text: 'Jag har torrt blekt hår och behöver ett bra schampo.',
      },
    });

    expect(result.interpretation.primaryIntent).toBe('product_recommendation');
    expect(result.interpretation.entities.requestedProductTypes).toEqual(['shampoo']);
    expect(result.interpretation.entities.needs).toEqual(
      expect.arrayContaining(['dry_hair_unspecified', 'bleached_hair']),
    );
    expect(result.interpretation.missingFields).toEqual(['drynessLocation']);
    expect(result.decision.plannedTools).toEqual([]);
    expect(result.state.status).toBe('collecting');
    expect(result.state.pendingQuestion).toEqual({
      id: 'dryness-location',
      expectedField: 'drynessLocation',
    });
    expect(result.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'question',
          expectedField: 'drynessLocation',
        }),
      ]),
    );
  });

  it('routes skincare to a specialist clarification without opening haircare tools', () => {
    const result = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'domain-skincare',
      message: { text: 'Jag söker ett serum för ansiktet.' },
    });

    expect(result.interpretation.primaryIntent).toBe('product_recommendation');
    expect(result.interpretation.entities.recommendationDomain).toBe('skincare');
    expect(result.interpretation.entities.requestedProductTypes).toEqual(['serum']);
    expect(result.interpretation.missingFields).toEqual(['skincareConcern']);
    expect(result.decision.plannedTools).toEqual([]);
    expect(result.decision.reasons).toContain(
      'clarification_required_before_product_search',
    );
    expect(result.safety.liveFactsUsed).toBe(false);
  });

  it.each([
    ['Jag söker en parfym.', 'fragrance', 'fragrance'],
    ['Jag söker en foundation.', 'makeup', 'foundation'],
    ['Jag söker ett nagellack.', 'nails', 'nail_polish'],
  ])(
    'routes %s to %s without opening haircare tools',
    (text, expectedDomain, expectedProductType) => {
      const result = service.handle({
        contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
        clientMessageId: `domain-${expectedDomain}`,
        message: { text },
      });

      expect(result.interpretation.primaryIntent).toBe('product_recommendation');
      expect(result.interpretation.entities.recommendationDomain).toBe(expectedDomain);
      expect(result.interpretation.entities.requestedProductTypes).toEqual([
        expectedProductType,
      ]);
      expect(result.interpretation.missingFields).toEqual([]);
      expect(result.decision.plannedTools).toEqual([]);
      expect(result.decision.reasons).toContain(
        'specialist_domain_not_enabled_for_tools',
      );
      expect(result.safety.liveFactsUsed).toBe(false);
    },
  );

  it('does not confuse fragrance avoidance with the fragrance recommendation domain', () => {
    const result = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'domain-fragrance-avoidance',
      message: { text: 'Jag söker leave-in utan parfym.' },
    });

    expect(result.interpretation.entities.recommendationDomain).toBe('haircare');
    expect(result.interpretation.entities.requestedProductTypes).toEqual(['leave_in']);
    expect(result.interpretation.entities.exclusions).toContain('fragrance');
    expect(result.decision.plannedTools).toEqual([
      'search_products',
      'analyze_product_suitability',
      'get_product_live_facts',
    ]);
  });

  it('generates opaque public identifiers instead of deriving them from the client message ID', () => {
    const result = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'customer-controlled-secret-looking-id',
      message: { text: 'Hej' },
    });

    expect(result.conversationId).toMatch(
      /^conversation-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(result.serverMessageId).toMatch(
      /^message-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(result.conversationId).not.toContain('customer-controlled');
    expect(result.serverMessageId).not.toContain('customer-controlled');
  });

  it('requires verified identity before any order or tracking tool can execute', () => {
    const result = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'client-2',
      message: { text: 'Varför har mitt paket inte kommit?' },
    });

    expect(result.interpretation.primaryIntent).toBe('tracking_status');
    expect(result.decision.requiresIdentity).toBe(true);
    expect(result.decision.plannedTools).toEqual([]);
    expect(result.state.pendingQuestion?.expectedField).toBe('verifiedOrderIdentity');
    expect(result.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'question', expectedField: 'verifiedOrderIdentity' }),
      ]),
    );
  });

  it('keeps human handoff explicit and not configured in the foundation', () => {
    const result = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'client-3',
      message: { text: 'Jag vill prata med kundtjänst' },
    });

    expect(result.state.status).toBe('handoff_required');
    expect(result.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'support_handoff', status: 'not_configured' }),
      ]),
    );
  });

  it('rejects browser-owned candidates, scores, state and tool choices', () => {
    expect(() =>
      service.handle({
        contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
        clientMessageId: 'client-4',
        message: { text: 'Vilket schampo passar?' },
        candidates: [],
      } as never),
    ).toThrow(BadRequestException);
  });

  it('rejects empty messages and unsupported contract versions', () => {
    expect(() =>
      service.handle({
        contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
        clientMessageId: 'client-5',
        message: { text: '   ' },
      }),
    ).toThrow('message_text_required');

    expect(() =>
      service.handle({
        contractVersion: 'wrong-version',
        clientMessageId: 'client-6',
        message: { text: 'Hej' },
      } as never),
    ).toThrow('unsupported_chat_contract_version');
  });
});
