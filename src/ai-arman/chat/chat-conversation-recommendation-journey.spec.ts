import type { HaircareRecommendationJourneyService } from '../discovery/haircare-recommendation-journey.service';
import { ChatConversationResultStore } from './chat-conversation-result.store';
import { ChatConversationStateStore } from './chat-conversation-state.store';
import { ChatConversationService } from './chat-conversation.service';
import { ChatMessagesService } from './chat-messages.service';
import { AI_ARMAN_CHAT_CONTRACT_VERSION } from './chat-messages.types';

function createService(prepare: jest.Mock) {
  const journey = { prepare } as unknown as HaircareRecommendationJourneyService;
  return new ChatConversationService(
    new ChatMessagesService(),
    new ChatConversationStateStore(),
    new ChatConversationResultStore(),
    undefined,
    journey,
  );
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
      message: { text: 'Schampo för torrt hår' },
    } as const;

    const first = await service.handleWithShadow(request);
    const repeated = await service.handleWithShadow(request);

    expect(repeated).toEqual(first);
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it('keeps verified product cards hidden from the regular chat in this slice', async () => {
    const prepare = jest.fn().mockResolvedValue({
      status: 'product_cards_ready',
      recommendations: [{ productId: '1' }],
      productCards: [{ productId: '1' }],
    });
    const service = createService(prepare);

    const response = await service.handleWithShadow({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'journey-cards-hidden-1',
      message: { text: 'Jag söker balsam för färgat hår.' },
    });

    expect(prepare).toHaveBeenCalledTimes(1);
    expect(response.decision.executionStatus).toBe('executed_read_only');
    expect(response.blocks.some((block) => block.type === 'product_cards')).toBe(false);
    expect(response.safety.liveFactsUsed).toBe(true);
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
