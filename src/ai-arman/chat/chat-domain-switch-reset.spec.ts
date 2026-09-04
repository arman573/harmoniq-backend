import { HaircareRecommendationJourneyService } from '../discovery/haircare-recommendation-journey.service';
import { ChatConversationResultStore } from './chat-conversation-result.store';
import { ChatConversationStateStore } from './chat-conversation-state.store';
import { ChatConversationService } from './chat-conversation.service';
import { ChatMessagesService } from './chat-messages.service';
import { AI_ARMAN_CHAT_CONTRACT_VERSION } from './chat-messages.types';

describe('AI Arman domain switching reset semantics v1', () => {
  function createConversationService(
    recommendationJourney?: HaircareRecommendationJourneyService,
  ) {
    return new ChatConversationService(
      new ChatMessagesService(),
      new ChatConversationStateStore(),
      new ChatConversationResultStore(),
      undefined,
      recommendationJourney,
    );
  }

  it('resets haircare specialist context when the customer explicitly switches to skincare', async () => {
    const prepare = jest.fn();
    const recommendationJourney = {
      prepare,
    } as unknown as HaircareRecommendationJourneyService;
    const service = createConversationService(recommendationJourney);

    const first = await service.handleWithShadow({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'domain-switch-hair-to-skin-1',
      message: {
        text: 'Jag söker schampo för torrt och färgat hår utan silikoner.',
      },
    });

    const second = await service.handleWithShadow({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      conversationId: first.conversationId,
      clientMessageId: 'domain-switch-hair-to-skin-2',
      message: { text: 'Förresten behöver jag en ansiktskräm.' },
    });

    expect(second.interpretation.entities.recommendationDomain).toBe('skincare');
    expect(second.interpretation.entities.requestedProductTypes).toEqual([
      'face_cream',
    ]);
    expect(second.interpretation.entities.needs).toEqual([]);
    expect(second.interpretation.entities.exclusions).toEqual([]);
    expect(second.interpretation.entities.skincareRoutineActives).toEqual([]);
    expect(second.interpretation.missingFields).toContain('skincareConcern');
    expect(second.interpretation.missingFields).not.toContain('drynessLocation');
    expect(second.decision.plannedTools).toEqual([]);
    expect(second.decision.reasons).toContain(
      'clarification_required_before_product_search',
    );
    expect(prepare).not.toHaveBeenCalled();
  });

  it('keeps only the new skincare need when a haircare conversation switches domains', () => {
    const service = createConversationService();
    const first = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'domain-switch-hair-to-skin-need-1',
      message: { text: 'Jag söker balsam för torrt och frissigt hår.' },
    });

    const second = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      conversationId: first.conversationId,
      clientMessageId: 'domain-switch-hair-to-skin-need-2',
      message: {
        text: 'Förresten behöver jag en ansiktskräm för känslig hud.',
      },
    });

    expect(second.interpretation.entities.recommendationDomain).toBe('skincare');
    expect(second.interpretation.entities.requestedProductTypes).toEqual([
      'face_cream',
    ]);
    expect(second.interpretation.entities.needs).toEqual(['sensitive_skin']);
    expect(second.interpretation.missingFields).not.toContain('skincareConcern');
    expect(second.decision.plannedTools).toEqual([]);
  });

  it('resets skincare needs, exclusions and routine actives when switching to haircare', () => {
    const service = createConversationService();
    const first = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'domain-switch-skin-to-hair-1',
      message: {
        text: 'Jag söker ett serum för torr hud utan parfym och använder retinol på kvällen.',
      },
    });

    const second = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      conversationId: first.conversationId,
      clientMessageId: 'domain-switch-skin-to-hair-2',
      message: { text: 'Förresten söker jag schampo för torrt hår.' },
    });

    expect(second.interpretation.entities.recommendationDomain).toBe('haircare');
    expect(second.interpretation.entities.requestedProductTypes).toEqual([
      'shampoo',
    ]);
    expect(second.interpretation.entities.needs).toContain('dry_hair_unspecified');
    expect(second.interpretation.entities.needs).not.toContain('dry_skin');
    expect(second.interpretation.entities.exclusions).toEqual([]);
    expect(second.interpretation.entities.skincareRoutineActives).toEqual([]);
    expect(second.interpretation.missingFields).toContain('drynessLocation');
    expect(second.interpretation.missingFields).not.toContain('skincareConcern');
    expect(second.safety.skincareRoutineReview).toBeUndefined();
  });

  it('preserves the existing specialist profile when a follow-up does not explicitly switch domain', () => {
    const service = createConversationService();
    const first = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'domain-switch-no-switch-1',
      message: { text: 'Jag söker ett serum för torr hud.' },
    });

    const second = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      conversationId: first.conversationId,
      clientMessageId: 'domain-switch-no-switch-2',
      message: { text: 'Jag använder retinol på kvällen.' },
    });

    expect(second.interpretation.entities.recommendationDomain).toBe('skincare');
    expect(second.interpretation.entities.requestedProductTypes).toEqual(['serum']);
    expect(second.interpretation.entities.needs).toContain('dry_skin');
    expect(second.interpretation.entities.skincareRoutineActives).toContainEqual({
      active: 'retinoid',
      timing: 'evening',
    });
  });
});
