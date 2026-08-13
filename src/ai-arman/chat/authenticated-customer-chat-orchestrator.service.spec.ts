import type { User } from '../../users/user.entity';
import { UserRole } from '../../users/user.entity';
import type { AuthenticatedAccountOrderAccessService } from '../identity/authenticated-account-order-access.service';
import type { VerifiedOrderReadService } from '../integrations/verified-order-read.service';
import type { AuthenticatedAfterPurchaseChatOrchestrator } from './authenticated-after-purchase-chat-orchestrator.service';
import { AuthenticatedCustomerChatOrchestrator } from './authenticated-customer-chat-orchestrator.service';
import type {
  ChatConversationResultRepository,
  ChatConversationStateRepository,
} from './chat-conversation.repositories';
import {
  AI_ARMAN_CHAT_CONTRACT_VERSION,
  AI_ARMAN_CONVERSATION_STATE_VERSION,
  type AiArmanChatRequest,
  type AiArmanChatResponse,
  type AiArmanIntent,
} from './chat-messages.types';

const USER: User = {
  id: 42,
  name: 'Customer',
  email: 'customer@example.com',
  role: UserRole.USER,
};

function request(text: string, clientMessageId: string): AiArmanChatRequest {
  return {
    contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
    conversationId: 'conversation_123',
    clientMessageId,
    message: { text },
  };
}

function response(
  intent: AiArmanIntent,
  orderReference: string | null,
): AiArmanChatResponse {
  const orderSupport = ['order_status', 'tracking_status'].includes(intent);
  return {
    contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
    conversationId: 'conversation_123',
    serverMessageId: 'message-123',
    interpretation: {
      schemaVersion: 'ai-arman-interpretation-v1',
      source: 'deterministic_fallback',
      locale: 'sv-SE',
      primaryIntent: intent,
      secondaryIntents: [],
      confidence: 0.9,
      entities: {
        requestedProductTypes: [],
        needs: [],
        exclusions: [],
        orderReference,
        productReferences: [],
      },
      missingFields: orderSupport && !orderReference ? ['orderReference'] : [],
      requiresIdentity: orderSupport,
      requiresHumanReview: false,
    },
    state: {
      stateVersion: AI_ARMAN_CONVERSATION_STATE_VERSION,
      conversationId: 'conversation_123',
      status: orderReference ? 'ready_for_tools' : 'collecting',
      activeJourney: orderSupport ? 'customer_service' : 'general',
      locale: 'sv-SE',
      identityLevel: 'anonymous',
      remembered: {
        requestedProductTypes: [],
        needs: [],
        exclusions: [],
        orderReference,
        productReferences: [],
      },
      pendingQuestion: null,
    },
    decision: {
      owner: 'backend_policy',
      route: orderSupport ? 'order_support' : 'general',
      plannedTools: [],
      executionStatus: 'not_executed_foundation',
      requiresIdentity: orderSupport,
      requiresConfirmation: false,
      reasons: ['foundation'],
    },
    blocks: [{ type: 'message', text: 'Foundation response' }],
    safety: {
      aiModelUsed: false,
      liveFactsUsed: false,
      writesExecuted: false,
      productionActionsEnabled: false,
      htmlAcceptedFromModel: false,
    },
  };
}

function build(responses: AiArmanChatResponse[], getOrder: jest.Mock) {
  const handle = jest.fn();
  for (const item of responses) handle.mockResolvedValueOnce(item);
  const afterPurchase = { handle } as unknown as AuthenticatedAfterPurchaseChatOrchestrator;
  const verifyAndBind = jest.fn().mockResolvedValue({
    ok: true,
    conversationId: 'conversation_123',
    orderId: '90250',
    expiresAt: 'future',
  });
  const accountAccess = { verifyAndBind } as unknown as AuthenticatedAccountOrderAccessService;
  const verifiedOrderRead = { getOrder } as unknown as VerifiedOrderReadService;
  const resultStore = {
    get: jest.fn().mockReturnValue({ fingerprint: 'fp' }),
    save: jest.fn((_key, _fingerprint, value) => value),
  } as unknown as ChatConversationResultRepository;
  const stateStore = {
    save: jest.fn((value) => value),
  } as unknown as ChatConversationStateRepository;

  return {
    service: new AuthenticatedCustomerChatOrchestrator(
      afterPurchase,
      accountAccess,
      verifiedOrderRead,
      resultStore,
      stateStore,
    ),
    verifyAndBind,
  };
}

function orderSuccess() {
  return {
    ok: true,
    order: {
      orderId: '90250',
      status: 'Skickad',
      statusId: 3,
      createdAt: '2026-08-12T10:00:00Z',
      shippingDate: '2026-08-13T09:00:00Z',
      dispatchState: 'dispatched',
    },
  };
}

describe('AuthenticatedCustomerChatOrchestrator', () => {
  it('verifies ownership before the first order status read and stays read only', async () => {
    const getOrder = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, error: 'verification_not_found' })
      .mockResolvedValueOnce(orderSuccess());
    const { service, verifyAndBind } = build(
      [response('order_status', '90250')],
      getOrder,
    );

    const result = await service.handle(
      request('Vad är status på order 90250?', 'client-1'),
      USER,
    );

    expect(verifyAndBind).toHaveBeenCalledWith({
      user: USER,
      conversationId: 'conversation_123',
      orderId: '90250',
    });
    expect(getOrder).toHaveBeenCalledTimes(2);
    expect(result.decision.plannedTools).toEqual(['get_order']);
    expect(result.decision.executionStatus).toBe('executed_read_only');
    expect(result.safety.liveFactsUsed).toBe(true);
    expect(result.safety.writesExecuted).toBe(false);
  });

  it('continues a verified order-status conversation without repeating the order number', async () => {
    const getOrder = jest.fn().mockResolvedValue(orderSuccess());
    const { service } = build(
      [response('order_status', '90250'), response('unknown', null)],
      getOrder,
    );

    await service.handle(
      request('Vad är status på order 90250?', 'client-1'),
      USER,
    );
    const followUp = await service.handle(
      request('Har det hänt något nu?', 'client-2'),
      USER,
    );

    expect(getOrder).toHaveBeenCalledTimes(2);
    expect(getOrder).toHaveBeenLastCalledWith({
      conversationId: 'conversation_123',
      userId: 42,
      orderId: '90250',
    });
    expect(followUp.decision.route).toBe('order_support');
    expect(followUp.decision.plannedTools).toEqual(['get_order']);
  });

  it('does not reuse remembered order context for another authenticated user', async () => {
    const getOrder = jest.fn().mockResolvedValue(orderSuccess());
    const { service } = build(
      [response('order_status', '90250'), response('unknown', null)],
      getOrder,
    );

    await service.handle(
      request('Vad är status på order 90250?', 'client-1'),
      USER,
    );
    const otherUser = { ...USER, id: 43, email: 'other@example.com' };
    const followUp = await service.handle(
      request('Har det hänt något nu?', 'client-2'),
      otherUser,
    );

    expect(getOrder).toHaveBeenCalledTimes(1);
    expect(followUp.decision.route).toBe('general');
    expect(followUp.safety.liveFactsUsed).toBe(false);
  });

  it('does not execute tracking as order status', async () => {
    const getOrder = jest.fn();
    const { service, verifyAndBind } = build(
      [response('tracking_status', '90250')],
      getOrder,
    );

    const result = await service.handle(
      request('Var är mitt paket för order 90250?', 'client-1'),
      USER,
    );

    expect(getOrder).not.toHaveBeenCalled();
    expect(verifyAndBind).not.toHaveBeenCalled();
    expect(result.decision.executionStatus).toBe('not_executed_foundation');
  });
});
