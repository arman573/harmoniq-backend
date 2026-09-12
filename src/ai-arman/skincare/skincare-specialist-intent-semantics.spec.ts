import { ChatConversationResultStore } from '../chat/chat-conversation-result.store';
import { ChatConversationStateStore } from '../chat/chat-conversation-state.store';
import { ChatConversationService } from '../chat/chat-conversation.service';
import { ChatMessagesService } from '../chat/chat-messages.service';
import { AI_ARMAN_CHAT_CONTRACT_VERSION } from '../chat/chat-messages.types';
import { SkincareSpecialistChatOrchestrator } from './skincare-specialist-chat-orchestrator.service';
import { extractSkincareSpecialistProfile } from './skincare-specialist-profile';

describe('AI Arman skincare specialist intent semantics v1', () => {
  function createService() {
    const stateStore = new ChatConversationStateStore();
    const conversation = new ChatConversationService(
      new ChatMessagesService(),
      stateStore,
      new ChatConversationResultStore(),
    );
    return new SkincareSpecialistChatOrchestrator(conversation, stateStore);
  }

  it.each([
    [
      'Jag använder retinol på kvällen.',
      { subject: 'retinoid', intent: 'current_use' },
    ],
    [
      'Jag använde retinol förut.',
      { subject: 'retinoid', intent: 'past_use' },
    ],
    [
      'Jag har slutat med retinol.',
      { subject: 'retinoid', intent: 'stopped_use' },
    ],
    [
      'Jag använder inte retinol.',
      { subject: 'retinoid', intent: 'not_using' },
    ],
    [
      'Jag reagerar på retinol.',
      { subject: 'retinoid', intent: 'prior_reaction' },
    ],
    [
      'Jag vill undvika niacinamid.',
      { subject: 'niacinamide', intent: 'avoid' },
    ],
    [
      'Jag vill börja med vitamin C.',
      { subject: 'vitamin_c', intent: 'wants_to_start' },
    ],
    [
      'Jag funderar på att börja med retinol.',
      { subject: 'retinoid', intent: 'wants_to_start' },
    ],
    [
      'Kan jag börja med vitamin C?',
      { subject: 'vitamin_c', intent: 'wants_to_start' },
    ],
    [
      'Jag vill ha hjälp med vitamin C.',
      { subject: 'vitamin_c', intent: 'seeking_guidance' },
    ],
  ])('classifies active intent in %s', (text, expected) => {
    const profile = extractSkincareSpecialistProfile(text);
    expect(profile.activeIntentContexts).toContainEqual(expected);
  });

  it('keeps explicit current use in the current routine', async () => {
    const service = createService();
    const result = await service.handleWithShadow({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'skincare-intent-current-1',
      message: {
        text: 'Jag söker ett serum för torr hud och använder retinol på kvällen.',
      },
    });

    expect(result.interpretation.entities.skincareRoutineActives).toContainEqual({
      active: 'retinoid',
      timing: 'evening',
    });
    expect(
      result.interpretation.entities.skincareSpecialistProfile?.activeIntentContexts,
    ).toContainEqual({ subject: 'retinoid', intent: 'current_use' });
    expect(result.decision.plannedTools).toEqual([]);
  });

  it.each([
    ['Jag använde retinol förut.', 'past_use'],
    ['Jag använder inte retinol.', 'not_using'],
    ['Jag vill börja med retinol.', 'wants_to_start'],
    ['Kan jag börja med retinol?', 'wants_to_start'],
    ['Jag vill ha hjälp med retinol.', 'seeking_guidance'],
  ])(
    'does not treat non-current retinoid language as routine use: %s',
    async (statement, intent) => {
      const service = createService();
      const result = await service.handleWithShadow({
        contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
        clientMessageId: `skincare-intent-non-current-${intent}`,
        message: {
          text: `Jag söker ett serum för torr hud. ${statement}`,
        },
      });

      expect(result.interpretation.entities.skincareRoutineActives).not.toContainEqual(
        expect.objectContaining({ active: 'retinoid' }),
      );
      expect(
        result.interpretation.entities.skincareSpecialistProfile?.activeIntentContexts,
      ).toContainEqual({ subject: 'retinoid', intent });
      expect(result.decision.plannedTools).toEqual([]);
    },
  );

  it('keeps current use separate from future intent for another active', async () => {
    const service = createService();
    const result = await service.handleWithShadow({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'skincare-intent-mixed-1',
      message: {
        text: 'Jag söker ett serum för torr hud. Jag använder niacinamid på morgonen men vill börja med vitamin C.',
      },
    });

    expect(result.interpretation.entities.skincareRoutineActives).toContainEqual({
      active: 'niacinamide',
      timing: 'morning',
    });
    expect(result.interpretation.entities.skincareRoutineActives).not.toContainEqual(
      expect.objectContaining({ active: 'vitamin_c' }),
    );
    expect(
      result.interpretation.entities.skincareSpecialistProfile?.activeIntentContexts,
    ).toEqual(
      expect.arrayContaining([
        { subject: 'niacinamide', intent: 'current_use' },
        { subject: 'vitamin_c', intent: 'wants_to_start' },
      ]),
    );
    expect(result.decision.plannedTools).toEqual([]);
  });

  it('replaces current-use intent with stopped-use intent and removes the active across turns', async () => {
    const service = createService();
    const first = await service.handleWithShadow({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'skincare-intent-stop-1',
      message: {
        text: 'Jag söker ett serum för torr hud och använder retinol på kvällen.',
      },
    });
    const second = await service.handleWithShadow({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      conversationId: first.conversationId,
      clientMessageId: 'skincare-intent-stop-2',
      message: { text: 'Jag har slutat med retinol.' },
    });

    expect(second.interpretation.entities.skincareRoutineActives).not.toContainEqual(
      expect.objectContaining({ active: 'retinoid' }),
    );
    expect(
      second.interpretation.entities.skincareSpecialistProfile?.activeIntentContexts,
    ).toContainEqual({ subject: 'retinoid', intent: 'stopped_use' });
    expect(
      second.interpretation.entities.skincareSpecialistProfile?.activeIntentContexts,
    ).not.toContainEqual({ subject: 'retinoid', intent: 'current_use' });
    expect(second.decision.plannedTools).toEqual([]);
  });

  it('does not let a future-use statement change current routine safety', async () => {
    const service = createService();
    const first = await service.handleWithShadow({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'skincare-intent-safety-1',
      message: {
        text: 'Jag söker ett serum för torr hud och använder retinol på kvällen.',
      },
    });
    const second = await service.handleWithShadow({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      conversationId: first.conversationId,
      clientMessageId: 'skincare-intent-safety-2',
      message: { text: 'Jag funderar på att börja med AHA.' },
    });

    expect(second.interpretation.entities.skincareRoutineActives).toContainEqual({
      active: 'retinoid',
      timing: 'evening',
    });
    expect(second.interpretation.entities.skincareRoutineActives).not.toContainEqual(
      expect.objectContaining({ active: 'aha' }),
    );
    expect(second.safety.skincareRoutineReview?.flags).not.toContain(
      'retinoid_with_exfoliating_acid',
    );
    expect(second.decision.plannedTools).toEqual([]);
  });
});
