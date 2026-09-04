import { ChatConversationResultStore } from '../chat/chat-conversation-result.store';
import { ChatConversationStateStore } from '../chat/chat-conversation-state.store';
import { ChatConversationService } from '../chat/chat-conversation.service';
import { ChatMessagesService } from '../chat/chat-messages.service';
import { AI_ARMAN_CHAT_CONTRACT_VERSION } from '../chat/chat-messages.types';
import { SkincareSpecialistChatOrchestrator } from './skincare-specialist-chat-orchestrator.service';

describe('AI Arman skincare specialist chat integration v1', () => {
  function createService() {
    const stateStore = new ChatConversationStateStore();
    const conversation = new ChatConversationService(
      new ChatMessagesService(),
      stateStore,
      new ChatConversationResultStore(),
    );
    return new SkincareSpecialistChatOrchestrator(conversation, stateStore);
  }

  it('adds the specialist profile without enabling skincare product tools', async () => {
    const service = createService();
    const result = await service.handleWithShadow({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'skincare-specialist-direct-1',
      message: {
        text: 'Jag söker ett serum för känslig hud. Min hud svider, huden stramar och jag har märken efter finnar.',
      },
    });

    expect(result.interpretation.entities.recommendationDomain).toBe('skincare');
    expect(result.interpretation.entities.skincareSpecialistProfile).toEqual(
      expect.objectContaining({
        barrierSignals: expect.arrayContaining(['stinging', 'tightness']),
        pigmentationConcerns: ['post_acne_marks'],
      }),
    );
    expect(result.state.remembered.skincareSpecialistProfile).toEqual(
      result.interpretation.entities.skincareSpecialistProfile,
    );
    expect(result.decision.plannedTools).toEqual([]);
    expect(result.decision.reasons).toContain(
      'specialist_domain_not_enabled_for_tools',
    );
  });

  it('preserves specialist context across turns and does not treat a reaction as routine use', async () => {
    const service = createService();
    const first = await service.handleWithShadow({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'skincare-specialist-multi-1',
      message: { text: 'Jag söker ett serum för känslig hud.' },
    });
    const second = await service.handleWithShadow({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      conversationId: first.conversationId,
      clientMessageId: 'skincare-specialist-multi-2',
      message: { text: 'Huden stramar och jag har märken efter finnar.' },
    });
    const third = await service.handleWithShadow({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      conversationId: first.conversationId,
      clientMessageId: 'skincare-specialist-multi-3',
      message: { text: 'Jag reagerar på niacinamid.' },
    });

    expect(second.interpretation.entities.skincareSpecialistProfile).toEqual(
      expect.objectContaining({
        barrierSignals: expect.arrayContaining(['tightness']),
        pigmentationConcerns: ['post_acne_marks'],
      }),
    );
    expect(third.interpretation.entities.skincareSpecialistProfile).toEqual(
      expect.objectContaining({
        barrierSignals: expect.arrayContaining(['tightness']),
        pigmentationConcerns: ['post_acne_marks'],
        avoidanceContexts: expect.arrayContaining([
          { subject: 'niacinamide', reason: 'prior_reaction' },
        ]),
      }),
    );
    expect(third.interpretation.entities.skincareRoutineActives).not.toContainEqual(
      expect.objectContaining({ active: 'niacinamide' }),
    );
    expect(third.state.remembered.skincareRoutineActives).not.toContainEqual(
      expect.objectContaining({ active: 'niacinamide' }),
    );
    expect(third.safety.skincareRoutineReview?.status).toBe('clear');
    expect(third.decision.plannedTools).toEqual([]);
  });

  it('clears the skincare specialist profile after an explicit domain switch', async () => {
    const service = createService();
    const first = await service.handleWithShadow({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'skincare-specialist-switch-1',
      message: {
        text: 'Jag söker ett serum för känslig hud. Min hud svider och jag reagerar på niacinamid.',
      },
    });
    const second = await service.handleWithShadow({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      conversationId: first.conversationId,
      clientMessageId: 'skincare-specialist-switch-2',
      message: { text: 'Förresten söker jag schampo för torrt hår.' },
    });

    expect(second.interpretation.entities.recommendationDomain).toBe('haircare');
    expect(second.interpretation.entities.skincareSpecialistProfile).toBeUndefined();
    expect(second.state.remembered.skincareSpecialistProfile).toBeUndefined();
  });
});
