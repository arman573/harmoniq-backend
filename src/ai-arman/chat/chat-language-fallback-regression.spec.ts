import { ChatConversationResultStore } from './chat-conversation-result.store';
import { ChatConversationStateStore } from './chat-conversation-state.store';
import { ChatConversationService } from './chat-conversation.service';
import type { ChatInterpretationShadowOrchestrator } from './chat-interpretation-shadow-orchestrator.service';
import { ChatMessagesService } from './chat-messages.service';
import { AI_ARMAN_CHAT_CONTRACT_VERSION } from './chat-messages.types';

describe('AI Arman Swedish fallback regression', () => {
  it('keeps complex Swedish haircare interpretation deterministic', () => {
    const response = new ChatMessagesService().handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'sv-fallback-language-1',
      message: {
        text: 'Jag har tunt och färgat hår som blir fett snabbt men torra längder. Vilket schampo passar?',
      },
    });

    expect(response.interpretation.source).toBe('deterministic_fallback');
    expect(response.interpretation.primaryIntent).toBe('product_recommendation');
    expect(response.interpretation.entities.requestedProductTypes).toEqual(['shampoo']);
    expect(response.interpretation.entities.needs).toEqual(
      expect.arrayContaining([
        'thin_hair',
        'color_treated_hair',
        'oily_scalp',
        'dry_lengths',
      ]),
    );
    expect(response.decision.owner).toBe('backend_policy');
    expect(response.safety.aiModelUsed).toBe(false);
  });

  it.each([
    'provider_timeout',
    'provider_quota',
    'provider_unavailable',
    'provider_invalid_response',
    'provider_error',
  ] as const)(
    'keeps the deterministic customer response when shadow returns %s',
    async (status) => {
      const run = jest.fn().mockResolvedValue({ status, comparison: null });
      const service = new ChatConversationService(
        new ChatMessagesService(),
        new ChatConversationStateStore(),
        new ChatConversationResultStore(),
        { run } as unknown as ChatInterpretationShadowOrchestrator,
      );

      const response = await service.handleWithShadow({
        contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
        clientMessageId: `sv-fallback-${status}`,
        message: { text: 'Jag söker schampo för tunt och färgat hår.' },
      });

      expect(run).toHaveBeenCalledTimes(1);
      expect(response.interpretation.source).toBe('deterministic_fallback');
      expect(response.interpretation.entities.requestedProductTypes).toEqual(['shampoo']);
      expect(response.interpretation.entities.needs).toEqual(
        expect.arrayContaining(['thin_hair', 'color_treated_hair']),
      );
      expect(response.decision.owner).toBe('backend_policy');
      expect(response.safety.aiModelUsed).toBe(false);
      expect(response.safety.productionActionsEnabled).toBe(false);
    },
  );
});
