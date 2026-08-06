import { BadRequestException } from '@nestjs/common';
import { ChatConversationStateStore } from './chat-conversation-state.store';
import { ChatConversationService } from './chat-conversation.service';
import { ChatMessagesService } from './chat-messages.service';
import { AI_ARMAN_CHAT_CONTRACT_VERSION } from './chat-messages.types';

describe('ChatConversationService', () => {
  function createService() {
    return new ChatConversationService(
      new ChatMessagesService(),
      new ChatConversationStateStore(),
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
    expect(first.state.pendingQuestion?.expectedField).toBe(
      'requestedProductType',
    );
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
});
