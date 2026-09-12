import { ChatConversationResultStore } from './chat-conversation-result.store';
import { ChatConversationStateStore } from './chat-conversation-state.store';
import { ChatConversationService } from './chat-conversation.service';
import { ChatMessagesService } from './chat-messages.service';
import { AI_ARMAN_CHAT_CONTRACT_VERSION } from './chat-messages.types';

describe('AI Arman skincare routine timing parser', () => {
  function createConversationService() {
    return new ChatConversationService(
      new ChatMessagesService(),
      new ChatConversationStateStore(),
      new ChatConversationResultStore(),
    );
  }

  it('maps evening retinoid and morning niacinamide independently', () => {
    const service = createConversationService();
    const result = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'skincare-timing-direct-1',
      message: {
        text: 'Jag söker ett serum för torr hud och använder retinol på kvällen och niacinamid på morgonen.',
      },
    });

    expect(result.interpretation.entities.skincareRoutineActives).toEqual(
      expect.arrayContaining([
        { active: 'retinoid', timing: 'evening' },
        { active: 'niacinamide', timing: 'morning' },
      ]),
    );
    expect(result.safety.skincareRoutineReview?.flags).not.toContain(
      'potentially_irritating_active_timing_unspecified',
    );
  });

  it('maps morning BHA and evening retinoid without a false unspecified-timing flag', () => {
    const service = createConversationService();
    const result = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'skincare-timing-direct-2',
      message: {
        text: 'Jag söker ett serum för torr hud och använder BHA på morgonen och retinol på kvällen.',
      },
    });

    expect(result.interpretation.entities.skincareRoutineActives).toEqual(
      expect.arrayContaining([
        { active: 'bha', timing: 'morning' },
        { active: 'retinoid', timing: 'evening' },
      ]),
    );
    expect(result.safety.skincareRoutineReview?.flags).toContain(
      'retinoid_with_exfoliating_acid',
    );
    expect(result.safety.skincareRoutineReview?.flags).not.toContain(
      'potentially_irritating_active_timing_unspecified',
    );
  });

  it('shares one explicit timing across a coordinated active group', () => {
    const service = createConversationService();
    const result = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'skincare-timing-shared-1',
      message: {
        text: 'Jag söker ett serum för torr hud och använder retinol och AHA på kvällen.',
      },
    });

    expect(result.interpretation.entities.skincareRoutineActives).toEqual(
      expect.arrayContaining([
        { active: 'retinoid', timing: 'evening' },
        { active: 'aha', timing: 'evening' },
      ]),
    );
    expect(result.safety.skincareRoutineReview?.flags).not.toContain(
      'potentially_irritating_active_timing_unspecified',
    );
  });

  it('keeps timing unspecified when one active is explicitly described for both morning and evening', () => {
    const service = createConversationService();
    const result = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'skincare-timing-ambiguous-1',
      message: {
        text: 'Jag söker ett serum för torr hud och använder retinol på morgonen och på kvällen.',
      },
    });

    expect(result.interpretation.entities.skincareRoutineActives).toContainEqual({
      active: 'retinoid',
      timing: 'unspecified',
    });
    expect(result.safety.skincareRoutineReview?.flags).toContain(
      'potentially_irritating_active_timing_unspecified',
    );
  });

  it('maps independent active timing in a skincare follow-up turn', () => {
    const service = createConversationService();
    const first = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'skincare-timing-multi-1',
      message: { text: 'Jag söker ett serum för torr hud.' },
    });

    const second = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      conversationId: first.conversationId,
      clientMessageId: 'skincare-timing-multi-2',
      message: {
        text: 'Jag använder retinol på kvällen och niacinamid på morgonen.',
      },
    });

    expect(second.interpretation.entities.skincareRoutineActives).toEqual(
      expect.arrayContaining([
        { active: 'retinoid', timing: 'evening' },
        { active: 'niacinamide', timing: 'morning' },
      ]),
    );
    expect(second.safety.skincareRoutineReview?.flags).not.toContain(
      'potentially_irritating_active_timing_unspecified',
    );
    expect(second.decision.plannedTools).toEqual([]);
  });
});
