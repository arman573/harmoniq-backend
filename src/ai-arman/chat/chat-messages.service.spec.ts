import { BadRequestException } from '@nestjs/common';
import { ChatMessagesService } from './chat-messages.service';
import { AI_ARMAN_CHAT_CONTRACT_VERSION } from './chat-messages.types';

describe('ChatMessagesService', () => {
  const service = new ChatMessagesService();

  it('interprets complex Swedish haircare free text without accepting candidates from the browser', () => {
    const result = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'client-1',
      message: {
        text: 'Jag har tunt och färgat hår som blir fett snabbt men torra längder. Vilket schampo passar?',
      },
      context: { locale: 'sv-SE', channel: 'web_widget' },
    });

    expect(result.interpretation.primaryIntent).toBe('product_recommendation');
    expect(result.interpretation.entities.requestedProductTypes).toEqual(['shampoo']);
    expect(result.interpretation.entities.needs).toEqual(
      expect.arrayContaining(['thin_hair', 'color_treated_hair', 'oily_scalp', 'dry_lengths']),
    );
    expect(result.decision.owner).toBe('backend_policy');
    expect(result.decision.plannedTools).toEqual([
      'search_products',
      'analyze_product_suitability',
      'get_product_live_facts',
    ]);
    expect(result.safety.liveFactsUsed).toBe(false);
    expect(result.safety.productionActionsEnabled).toBe(false);
  });

  it('generates opaque public identifiers instead of deriving them from the client message ID', () => {
    const result = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'customer-controlled-secret-looking-id',
      message: { text: 'Hej' },
    });

    expect(result.conversationId).toMatch(
      /^conversation-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(result.serverMessageId).toMatch(
      /^message-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(result.conversationId).not.toContain('customer-controlled');
    expect(result.serverMessageId).not.toContain('customer-controlled');
  });

  it('requires verified identity before any order or tracking tool can execute', () => {
    const result = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'client-2',
      message: { text: 'Varför har mitt paket inte kommit?' },
    });

    expect(result.interpretation.primaryIntent).toBe('tracking_status');
    expect(result.decision.requiresIdentity).toBe(true);
    expect(result.decision.plannedTools).toEqual([]);
    expect(result.state.pendingQuestion?.expectedField).toBe('verifiedOrderIdentity');
    expect(result.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'question', expectedField: 'verifiedOrderIdentity' }),
      ]),
    );
  });

  it('keeps human handoff explicit and not configured in the foundation', () => {
    const result = service.handle({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'client-3',
      message: { text: 'Jag vill prata med kundtjänst' },
    });

    expect(result.state.status).toBe('handoff_required');
    expect(result.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'support_handoff', status: 'not_configured' }),
      ]),
    );
  });

  it('rejects browser-owned candidates, scores, state and tool choices', () => {
    expect(() =>
      service.handle({
        contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
        clientMessageId: 'client-4',
        message: { text: 'Vilket schampo passar?' },
        candidates: [],
      } as never),
    ).toThrow(BadRequestException);
  });

  it('rejects empty messages and unsupported contract versions', () => {
    expect(() =>
      service.handle({
        contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
        clientMessageId: 'client-5',
        message: { text: '   ' },
      }),
    ).toThrow('message_text_required');

    expect(() =>
      service.handle({
        contractVersion: 'wrong-version',
        clientMessageId: 'client-6',
        message: { text: 'Hej' },
      } as never),
    ).toThrow('unsupported_chat_contract_version');
  });
});
