import { BadRequestException } from '@nestjs/common';
import {
  ChatConversationResultRepository,
  ChatConversationStateRepository,
  type StoredChatResult,
} from './chat-conversation.repositories';
import { ChatConversationResultStore } from './chat-conversation-result.store';
import { ChatConversationStateStore } from './chat-conversation-state.store';
import { ChatConversationService } from './chat-conversation.service';
import type { ChatInterpretationShadowOrchestrator } from './chat-interpretation-shadow-orchestrator.service';
import { ChatMessagesService } from './chat-messages.service';
import {
  AI_ARMAN_CHAT_CONTRACT_VERSION,
  type AiArmanChatResponse,
  type AiArmanConversationState,
} from './chat-messages.types';

describe('ChatConversationService', () => {
  function createService(
    shadowOrchestrator?: ChatInterpretationShadowOrchestrator,
  ) {
    return new ChatConversationService(
      new ChatMessagesService(),
      new ChatConversationStateStore(),
      new ChatConversationResultStore(),
      shadowOrchestrator,
    );
  }

  it('merges a short follow-up into the server-owned product need profile', () => {
    const service = createService();
    const first = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'multi-1',
      message: { text: 'Jag har färgat och torrt hår.' },
    });

    expect(first.interpretation.primaryIntent).toBe('product_recommendation');
    expect(first.state.status).toBe('collecting');
    expect(first.state.pendingQuestion?.expectedField).toBe('requestedProductType');
    expect(first.state.remembered.needs).toEqual(
      expect.arrayContaining(['color_treated_hair', 'dry_lengths']),
    );

    const second = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      conversationId: first.conversationId,
      clientMessageId: 'multi-2',
      message: { text: 'Schampo' },
    });

    expect(second.conversationId).toBe(first.conversationId);
    expect(second.state.status).toBe('ready_for_tools');
    expect(second.state.pendingQuestion).toBeNull();
    expect(second.state.remembered.requestedProductTypes).toEqual(['shampoo']);
    expect(second.state.remembered.needs).toEqual(
      expect.arrayContaining(['color_treated_hair', 'dry_lengths']),
    );
    expect(second.decision.plannedTools).toEqual([
      'search_products',
      'analyze_product_suitability',
      'get_product_live_facts',
    ]);
  });

  it('returns the original response for an identical repeated client message', () => {
    const service = createService();
    const request = {
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'repeat-1',
      message: { text: 'Jag har tunt hår och söker schampo.' },
    } as const;

    const first = service.handle(request);
    const repeated = service.handle(request);

    expect(repeated).toEqual(first);
    expect(repeated.serverMessageId).toBe(first.serverMessageId);
    expect(repeated.conversationId).toBe(first.conversationId);
  });

  it('returns the same customer response when passive shadow handling is used', async () => {
    const run = jest.fn().mockResolvedValue({
      status: 'disabled',
      comparison: null,
    });
    const service = createService({ run } as unknown as ChatInterpretationShadowOrchestrator);
    const request = {
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'shadow-passive-1',
      message: { text: 'Jag söker schampo för tunt hår.' },
    } as const;

    const response = await service.handleWithShadow(request);

    expect(response.interpretation.source).toBe('deterministic_fallback');
    expect(response.safety.aiModelUsed).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(response.interpretation, {
      text: request.message.text,
      locale: 'sv-SE',
      previousState: null,
    });
  });

  it('does not run shadow evaluation again for an idempotent replay', async () => {
    const run = jest.fn().mockResolvedValue({
      status: 'disabled',
      comparison: null,
    });
    const service = createService({ run } as unknown as ChatInterpretationShadowOrchestrator);
    const request = {
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'shadow-replay-1',
      message: { text: 'Jag söker balsam för färgat hår.' },
    } as const;

    const first = await service.handleWithShadow(request);
    const repeated = await service.handleWithShadow(request);

    expect(repeated).toEqual(first);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('rejects reuse of a client message ID with changed content', () => {
    const service = createService();
    service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'conflict-1',
      message: { text: 'Schampo för torrt hår' },
    });

    expect(() =>
      service.handle({
        contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
        clientMessageId: 'conflict-1',
        message: { text: 'Balsam för fett hår' },
      }),
    ).toThrow('client_message_id_conflict');
  });

  it('keeps conversation state isolated between conversation IDs', () => {
    const service = createService();
    const first = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'isolated-1',
      message: { text: 'Jag har färgat hår och vill undvika parfym.' },
    });
    const other = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'isolated-2',
      message: { text: 'Jag har tunt hår.' },
    });

    const continued = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      conversationId: other.conversationId,
      clientMessageId: 'isolated-3',
      message: { text: 'Balsam' },
    });

    expect(continued.state.remembered.needs).toContain('thin_hair');
    expect(continued.state.remembered.needs).not.toContain('color_treated_hair');
    expect(continued.state.remembered.exclusions).not.toContain('fragrance');
    expect(first.conversationId).not.toBe(other.conversationId);
  });

  it('fails closed when the browser supplies an unknown conversation ID', () => {
    const service = createService();

    expect(() =>
      service.handle({
        contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
        conversationId: 'conversation-does-not-exist',
        clientMessageId: 'unknown-1',
        message: { text: 'Schampo' },
      }),
    ).toThrow(BadRequestException);
  });

  it('works against repository contracts without depending on Map stores', () => {
    class TestStateRepository extends ChatConversationStateRepository {
      state: AiArmanConversationState | null = null;

      get(conversationId: string) {
        return this.state?.conversationId === conversationId ? this.state : null;
      }

      save(state: AiArmanConversationState) {
        this.state = state;
        return state;
      }
    }

    class TestResultRepository extends ChatConversationResultRepository {
      result: StoredChatResult | null = null;

      get() {
        return this.result;
      }

      save(_key: string, fingerprint: string, response: AiArmanChatResponse) {
        this.result = { fingerprint, response };
        return response;
      }
    }

    const stateRepository = new TestStateRepository();
    const resultRepository = new TestResultRepository();
    const service = new ChatConversationService(
      new ChatMessagesService(),
      stateRepository,
      resultRepository,
    );

    const response = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'repository-contract-1',
      message: { text: 'Jag söker balsam för tunt hår.' },
    });

    expect(stateRepository.state?.conversationId).toBe(response.conversationId);
    expect(resultRepository.result?.response).toEqual(response);
  });
});
