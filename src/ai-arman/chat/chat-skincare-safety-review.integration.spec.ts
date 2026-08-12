import { ChatConversationResultStore } from './chat-conversation-result.store';
import { ChatConversationStateStore } from './chat-conversation-state.store';
import { ChatConversationService } from './chat-conversation.service';
import { ChatMessagesService } from './chat-messages.service';
import { AI_ARMAN_CHAT_CONTRACT_VERSION } from './chat-messages.types';

describe('AI Arman skincare safety review conversation integration', () => {
  function createConversationService() {
    return new ChatConversationService(
      new ChatMessagesService(),
      new ChatConversationStateStore(),
      new ChatConversationResultStore(),
    );
  }

  it('attaches a clear backend-owned review for a simple skincare routine', () => {
    const service = createConversationService();
    const result = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'skincare-safety-clear-1',
      message: {
        text: 'Jag söker ett serum för torr hud och använder niacinamid på morgonen.',
      },
    });

    expect(result.safety.skincareRoutineReview).toEqual({
      version: 'skincare-routine-safety-review-v1',
      status: 'clear',
      flags: [],
      requiresReview: false,
      blocksRecommendation: false,
    });
    expect(result.decision.plannedTools).toEqual([]);
  });

  it('attaches a review flag for retinoid with exfoliating acid in one turn', () => {
    const service = createConversationService();
    const result = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'skincare-safety-combination-1',
      message: {
        text: 'Jag söker ett serum för torr hud och använder retinol och AHA på kvällen.',
      },
    });

    expect(result.safety.skincareRoutineReview?.status).toBe('review_required');
    expect(result.safety.skincareRoutineReview?.flags).toContain(
      'retinoid_with_exfoliating_acid',
    );
    expect(result.safety.skincareRoutineReview?.blocksRecommendation).toBe(false);
    expect(result.decision.plannedTools).toEqual([]);
  });

  it('reviews the merged skincare routine across turns', () => {
    const service = createConversationService();
    const first = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'skincare-safety-multi-1',
      message: {
        text: 'Jag söker ett serum för känslig hud och använder retinol på kvällen.',
      },
    });

    const second = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      conversationId: first.conversationId,
      clientMessageId: 'skincare-safety-multi-2',
      message: { text: 'Jag använder också BHA på morgonen.' },
    });

    expect(second.interpretation.entities.skincareRoutineActives).toEqual(
      expect.arrayContaining([
        { active: 'retinoid', timing: 'evening' },
        { active: 'bha', timing: 'morning' },
      ]),
    );
    expect(second.safety.skincareRoutineReview?.flags).toEqual(
      expect.arrayContaining([
        'retinoid_with_exfoliating_acid',
        'sensitive_skin_with_potentially_irritating_active',
      ]),
    );
    expect(second.safety.skincareRoutineReview?.blocksRecommendation).toBe(false);
    expect(second.decision.plannedTools).toEqual([]);
  });

  it('keeps skincare review null outside the skincare domain', () => {
    const service = createConversationService();
    const result = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'skincare-safety-haircare-1',
      message: { text: 'Jag söker schampo för färgat hår.' },
    });

    expect(result.safety.skincareRoutineReview).toBeNull();
  });
});
