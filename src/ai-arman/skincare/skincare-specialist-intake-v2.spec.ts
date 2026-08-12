import { ChatConversationResultStore } from '../chat/chat-conversation-result.store';
import { ChatConversationStateStore } from '../chat/chat-conversation-state.store';
import { ChatConversationService } from '../chat/chat-conversation.service';
import { ChatMessagesService } from '../chat/chat-messages.service';
import { AI_ARMAN_CHAT_CONTRACT_VERSION } from '../chat/chat-messages.types';
import { SkincareSpecialistChatOrchestrator } from './skincare-specialist-chat-orchestrator.service';
import { extractSkincareSpecialistProfile } from './skincare-specialist-profile';

describe('AI Arman skincare specialist intake v2', () => {
  function createService() {
    const stateStore = new ChatConversationStateStore();
    const conversation = new ChatConversationService(
      new ChatMessagesService(),
      stateStore,
      new ChatConversationResultStore(),
    );
    return new SkincareSpecialistChatOrchestrator(conversation, stateStore);
  }

  it('does not classify negated sensitivity as an avoidance signal', () => {
    const profile = extractSkincareSpecialistProfile(
      'Jag är inte känslig mot niacinamid och använder det på morgonen.',
    );

    expect(profile.avoidanceContexts).not.toContainEqual({
      subject: 'niacinamide',
      reason: 'sensitivity',
    });
  });

  it('does not treat an explicitly negated active as current routine use', async () => {
    const service = createService();
    const result = await service.handleWithShadow({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'skincare-intake-v2-negated-use-1',
      message: {
        text: 'Jag söker ett serum för känslig hud. Jag använder inte retinol.',
      },
    });

    expect(result.interpretation.entities.skincareRoutineActives).not.toContainEqual(
      expect.objectContaining({ active: 'retinoid' }),
    );
    expect(result.state.remembered.skincareRoutineActives).not.toContainEqual(
      expect.objectContaining({ active: 'retinoid' }),
    );
    expect(result.decision.plannedTools).toEqual([]);
  });

  it('does not preserve an active that the customer says they stopped using', async () => {
    const service = createService();
    const first = await service.handleWithShadow({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'skincare-intake-v2-stopped-1',
      message: {
        text: 'Jag söker ett serum för torr hud och använder retinol på kvällen.',
      },
    });
    const second = await service.handleWithShadow({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      conversationId: first.conversationId,
      clientMessageId: 'skincare-intake-v2-stopped-2',
      message: { text: 'Jag har slutat med retinol och använder det inte längre.' },
    });

    expect(second.interpretation.entities.skincareRoutineActives).not.toContainEqual(
      expect.objectContaining({ active: 'retinoid' }),
    );
    expect(second.state.remembered.skincareRoutineActives).not.toContainEqual(
      expect.objectContaining({ active: 'retinoid' }),
    );
    expect(second.decision.plannedTools).toEqual([]);
  });

  it('keeps current routine use separate from another active the customer wants to avoid', async () => {
    const service = createService();
    const result = await service.handleWithShadow({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'skincare-intake-v2-mixed-1',
      message: {
        text: 'Jag söker ett serum för torr hud. Jag använder niacinamid på morgonen men vill undvika AHA.',
      },
    });

    expect(result.interpretation.entities.skincareRoutineActives).toContainEqual({
      active: 'niacinamide',
      timing: 'morning',
    });
    expect(result.interpretation.entities.skincareRoutineActives).not.toContainEqual(
      expect.objectContaining({ active: 'aha' }),
    );
    expect(
      result.interpretation.entities.skincareSpecialistProfile?.avoidanceContexts,
    ).toContainEqual({ subject: 'aha', reason: 'preference' });
    expect(result.decision.plannedTools).toEqual([]);
  });
});
