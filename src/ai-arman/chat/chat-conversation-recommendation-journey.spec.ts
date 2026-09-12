import type { HaircareRecommendationJourneyService } from '../discovery/haircare-recommendation-journey.service';
import type { ProductRecommendationCard } from '../recommendation/product-recommendation-card.types';
import { ChatConversationResultStore } from './chat-conversation-result.store';
import { ChatConversationStateStore } from './chat-conversation-state.store';
import { ChatConversationService } from './chat-conversation.service';
import { ChatMessagesService } from './chat-messages.service';
import { AI_ARMAN_CHAT_CONTRACT_VERSION } from './chat-messages.types';
import { ProductCardBlockMapper } from './product-card-block.mapper';

function createService(prepare: jest.Mock) {
  const journey = { prepare } as unknown as HaircareRecommendationJourneyService;
  return new ChatConversationService(
    new ChatMessagesService(),
    new ChatConversationStateStore(),
    new ChatConversationResultStore(),
    undefined,
    journey,
    new ProductCardBlockMapper(),
  );
}

function verifiedCard(
  productId = '1',
  overrides: Partial<ProductRecommendationCard> = {},
): ProductRecommendationCard {
  return {
    schemaVersion: 'ai-arman-product-card-v1',
    type: 'product_card',
    position: 1,
    label: 'Bäst matchning',
    productId,
    title: `Produkt ${productId}`,
    imageUrl: `https://www.harmoniq.se/product-${productId}.jpg`,
    productUrl: `https://www.harmoniq.se/product-${productId}`,
    price: { amount: 199, currency: 'SEK' },
    availability: { status: 'in_stock', quantity: 2 },
    whyItFits: ['Bra matchning'],
    inciSignals: ['Relevant INCI-signal'],
    limitations: [],
    quality: {
      score: 85,
      rankingScore: 87,
      tier: 'A',
      confidence: 90,
    },
    verification: {
      productFactsSource: 'vendre',
      fetchedAt: '2026-08-07T18:00:00.000Z',
    },
    ...overrides,
  };
}

describe('ChatConversationService recommendation journey execution', () => {
  it('executes the backend-owned journey when the recommendation profile is ready', async () => {
    const prepare = jest.fn().mockResolvedValue({
      status: 'live_facts_unavailable',
      recommendations: [],
      productCards: [],
    });
    const service = createService(prepare);

    const response = await service.handleWithShadow({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'journey-ready-1',
      message: { text: 'Jag söker schampo för tunt och färgat hår.' },
    });

    expect(prepare).toHaveBeenCalledTimes(1);
    expect(prepare).toHaveBeenCalledWith(response.interpretation);
    expect(response.state.status).toBe('ready_for_tools');
    expect(response.decision.route).toBe('recommendation');
    expect(response.decision.executionStatus).toBe('failed_closed');
    expect(response.decision.reasons).toContain(
      'recommendation_journey:live_facts_unavailable',
    );
    expect(response.blocks.some((block) => block.type === 'product_cards')).toBe(false);
    expect(response.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'error_notice',
          code: 'product_live_facts_unavailable',
        }),
      ]),
    );
    expect(response.safety.liveFactsUsed).toBe(false);
    expect(response.safety.writesExecuted).toBe(false);
    expect(response.safety.productionActionsEnabled).toBe(false);
  });

  it('does not execute the journey while a required clarification is missing', async () => {
    const prepare = jest.fn();
    const service = createService(prepare);

    const response = await service.handleWithShadow({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'journey-clarify-1',
      message: { text: 'Jag har tunt och färgat hår.' },
    });

    expect(prepare).not.toHaveBeenCalled();
    expect(response.state.status).toBe('collecting');
    expect(response.state.pendingQuestion?.expectedField).toBe(
      'requestedProductType',
    );
    expect(response.decision.executionStatus).toBe(
      'not_executed_foundation',
    );
  });

  it('does not execute the haircare journey while skincare needs clarification', async () => {
    const prepare = jest.fn();
    const service = createService(prepare);

    const response = await service.handleWithShadow({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'journey-domain-skincare',
      message: { text: 'Jag söker ett serum för ansiktet.' },
    });

    expect(prepare).not.toHaveBeenCalled();
    expect(response.interpretation.entities.recommendationDomain).toBe('skincare');
    expect(response.interpretation.missingFields).toContain('skincareConcern');
    expect(response.decision.plannedTools).toEqual([]);
    expect(response.decision.reasons).toContain(
      'clarification_required_before_product_search',
    );
    expect(response.safety.liveFactsUsed).toBe(false);
  });

  it.each([
    ['Jag söker en parfym.', 'fragrance'],
    ['Jag söker en foundation.', 'makeup'],
    ['Jag söker ett nagellack.', 'nails'],
  ])(
    'does not execute the haircare journey for %s',
    async (text, expectedDomain) => {
      const prepare = jest.fn();
      const service = createService(prepare);

      const response = await service.handleWithShadow({
        contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
        clientMessageId: `journey-domain-${expectedDomain}`,
        message: { text },
      });

      expect(prepare).not.toHaveBeenCalled();
      expect(response.interpretation.entities.recommendationDomain).toBe(
        expectedDomain,
      );
      expect(response.decision.plannedTools).toEqual([]);
      expect(response.decision.reasons).toContain(
        'specialist_domain_not_enabled_for_tools',
      );
      expect(response.safety.liveFactsUsed).toBe(false);
    },
  );

  it('executes the journey after a natural product-type follow-up and preserves prior needs and exclusions', async () => {
    const prepare = jest.fn().mockResolvedValue({
      status: 'no_verified_candidates',
      recommendations: [],
      productCards: [],
    });
    const service = createService(prepare);

    const first = await service.handleWithShadow({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'journey-multi-product-type-1',
      message: { text: 'Jag har slitet och frissigt hår.' },
    });

    expect(prepare).not.toHaveBeenCalled();
    expect(first.state.pendingQuestion?.expectedField).toBe('requestedProductType');
    expect(first.state.remembered.needs).toEqual(
      expect.arrayContaining(['damaged_hair', 'frizz_control']),
    );

    const second = await service.handleWithShadow({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      conversationId: first.conversationId,
      clientMessageId: 'journey-multi-product-type-2',
      message: { text: 'Leave-in, gärna oparfymerat och utan silikoner.' },
    });

    expect(prepare).toHaveBeenCalledTimes(1);
    const preparedInterpretation = prepare.mock.calls[0][0];
    expect(preparedInterpretation.entities.requestedProductTypes).toEqual([
      'leave_in',
    ]);
    expect(preparedInterpretation.entities.needs).toEqual(
      expect.arrayContaining(['damaged_hair', 'frizz_control']),
    );
    expect(preparedInterpretation.entities.exclusions).toEqual(
      expect.arrayContaining(['fragrance', 'silicones']),
    );
    expect(second.state.status).toBe('ready_for_tools');
    expect(second.decision.executionStatus).toBe('executed_read_only');
    expect(second.decision.reasons).toContain(
      'recommendation_journey:no_verified_candidates',
    );
  });

  it('does not execute the recommendation journey for unrelated intents', async () => {
    const prepare = jest.fn();
    const service = createService(prepare);

    const response = await service.handleWithShadow({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'journey-other-1',
      message: { text: 'Hej' },
    });

    expect(prepare).not.toHaveBeenCalled();
    expect(response.interpretation.primaryIntent).toBe('greeting');
  });

  it('does not execute the journey again for an idempotent replay', async () => {
    const prepare = jest.fn().mockResolvedValue({
      status: 'live_facts_unavailable',
      recommendations: [],
      productCards: [],
    });
    const service = createService(prepare);
    const request = {
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'journey-replay-1',
      message: { text: 'Schampo för torra längder' },
    } as const;

    const first = await service.handleWithShadow(request);
    const repeated = await service.handleWithShadow(request);

    expect(repeated).toEqual(first);
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it('maps verified journey cards into the regular chat response', async () => {
    const prepare = jest.fn().mockResolvedValue({
      status: 'product_cards_ready',
      recommendations: [{ productId: '1' }],
      productCards: [verifiedCard('1')],
    });
    const service = createService(prepare);

    const response = await service.handleWithShadow({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'journey-cards-ready-1',
      message: { text: 'Jag söker balsam för färgat hår.' },
    });

    expect(response.decision.executionStatus).toBe('executed_read_only');
    const block = response.blocks.find((item) => item.type === 'product_cards');
    expect(block).toEqual({
      type: 'product_cards',
      cards: [
        {
          productId: '1',
          title: 'Produkt 1',
          imageUrl: 'https://www.harmoniq.se/product-1.jpg',
          productUrl: 'https://www.harmoniq.se/product-1',
          price: 199,
          currency: 'SEK',
          stockStatus: 'in_stock',
          whyItFits: ['Bra matchning'],
          inciSignals: ['Relevant INCI-signal'],
          limitations: [],
          usage: [],
          confidence: 90,
          factsFetchedAt: '2026-08-07T18:00:00.000Z',
        },
      ],
    });
    expect(response.safety.liveFactsUsed).toBe(true);
    expect(response.safety.writesExecuted).toBe(false);
    expect(response.safety.productionActionsEnabled).toBe(false);
  });

  it('fails closed when product_cards_ready contains invalid card data', async () => {
    const prepare = jest.fn().mockResolvedValue({
      status: 'product_cards_ready',
      recommendations: [{ productId: '1' }],
      productCards: [
        verifiedCard('1', {
          price: { amount: 19, currency: 'EUR' },
        }),
      ],
    });
    const service = createService(prepare);

    const response = await service.handleWithShadow({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'journey-card-invalid-1',
      message: { text: 'Jag söker schampo för tunt hår.' },
    });

    expect(response.decision.executionStatus).toBe('failed_closed');
    expect(response.decision.reasons).toContain(
      'recommendation_journey_failed_closed',
    );
    expect(response.blocks.some((block) => block.type === 'product_cards')).toBe(false);
    expect(response.safety.productionActionsEnabled).toBe(false);
  });

  it('fails closed when the recommendation journey throws unexpectedly', async () => {
    const prepare = jest.fn().mockRejectedValue(new Error('upstream details'));
    const service = createService(prepare);

    const response = await service.handleWithShadow({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'journey-error-1',
      message: { text: 'Jag söker leave-in för friss.' },
    });

    expect(response.decision.executionStatus).toBe('failed_closed');
    expect(response.decision.reasons).toContain(
      'recommendation_journey_failed_closed',
    );
    expect(response.blocks.some((block) => block.type === 'product_cards')).toBe(false);
    expect(JSON.stringify(response)).not.toContain('upstream details');
  });
});
