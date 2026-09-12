import { ChatConversationResultStore } from './chat-conversation-result.store';
import { ChatConversationStateStore } from './chat-conversation-state.store';
import { ChatConversationService } from './chat-conversation.service';
import { ChatMessagesService } from './chat-messages.service';
import { AI_ARMAN_CHAT_CONTRACT_VERSION } from './chat-messages.types';

describe('AI Arman skincare specialist intake v1', () => {
  function createConversationService() {
    return new ChatConversationService(
      new ChatMessagesService(),
      new ChatConversationStateStore(),
      new ChatConversationResultStore(),
    );
  }

  it('extracts common skincare concerns while keeping skincare tools disabled', () => {
    const service = new ChatMessagesService();
    const result = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'skincare-intake-1',
      message: {
        text: 'Jag söker ett serum. Min hud är torr och känslig och jag får finnar.',
      },
    });

    expect(result.interpretation.primaryIntent).toBe('product_recommendation');
    expect(result.interpretation.entities.recommendationDomain).toBe('skincare');
    expect(result.interpretation.entities.requestedProductTypes).toEqual(['serum']);
    expect(result.interpretation.entities.needs).toEqual(
      expect.arrayContaining([
        'dry_skin',
        'sensitive_skin',
        'acne_prone_skin',
      ]),
    );
    expect(result.interpretation.missingFields).toEqual([]);
    expect(result.decision.plannedTools).toEqual([]);
    expect(result.decision.reasons).toContain(
      'specialist_domain_not_enabled_for_tools',
    );
  });

  it('asks for the skincare concern when only the product type is known', () => {
    const service = new ChatMessagesService();
    const result = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'skincare-intake-2',
      message: { text: 'Jag söker ett serum för ansiktet.' },
    });

    expect(result.interpretation.entities.recommendationDomain).toBe('skincare');
    expect(result.interpretation.missingFields).toEqual(['skincareConcern']);
    expect(result.state.status).toBe('collecting');
    expect(result.state.pendingQuestion).toEqual({
      id: 'skincare-concern',
      expectedField: 'skincareConcern',
    });
    expect(result.decision.plannedTools).toEqual([]);
  });

  it('resolves a natural skincare concern follow-up and preserves the product type and domain', () => {
    const service = createConversationService();
    const first = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'skincare-multi-1',
      message: { text: 'Jag söker ett serum för ansiktet.' },
    });

    const second = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      conversationId: first.conversationId,
      clientMessageId: 'skincare-multi-2',
      message: { text: 'Jag är torr och känslig och får lite finnar.' },
    });

    expect(second.conversationId).toBe(first.conversationId);
    expect(second.interpretation.primaryIntent).toBe('product_recommendation');
    expect(second.state.remembered.recommendationDomain).toBe('skincare');
    expect(second.state.remembered.requestedProductTypes).toEqual(['serum']);
    expect(second.state.remembered.needs).toEqual(
      expect.arrayContaining([
        'dry_skin',
        'sensitive_skin',
        'acne_prone_skin',
      ]),
    );
    expect(second.interpretation.missingFields).toEqual([]);
    expect(second.state.pendingQuestion).toBeNull();
    expect(second.decision.plannedTools).toEqual([]);
    expect(second.decision.reasons).toContain(
      'specialist_domain_not_enabled_for_tools',
    );
  });

  it('keeps asking when the skincare concern follow-up is still ambiguous', () => {
    const service = createConversationService();
    const first = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'skincare-ambiguous-1',
      message: { text: 'Jag söker en ansiktskräm.' },
    });

    const second = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      conversationId: first.conversationId,
      clientMessageId: 'skincare-ambiguous-2',
      message: { text: 'Vet inte riktigt.' },
    });

    expect(second.state.remembered.recommendationDomain).toBe('skincare');
    expect(second.state.remembered.requestedProductTypes).toEqual(['face_cream']);
    expect(second.state.pendingQuestion?.expectedField).toBe('skincareConcern');
    expect(second.decision.plannedTools).toEqual([]);
  });
});
