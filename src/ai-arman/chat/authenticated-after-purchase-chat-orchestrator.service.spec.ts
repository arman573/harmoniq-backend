import type { User } from '../../users/user.entity';
import { UserRole } from '../../users/user.entity';
import type { AuthenticatedAccountOrderAccessService } from '../identity/authenticated-account-order-access.service';
import type { VerifiedReturnsReadService } from '../integrations/verified-returns-read.service';
import type { SkincareSpecialistChatOrchestrator } from '../skincare/skincare-specialist-chat-orchestrator.service';
import { AuthenticatedAfterPurchaseChatOrchestrator } from './authenticated-after-purchase-chat-orchestrator.service';
import type {
  ChatConversationResultRepository,
  ChatConversationStateRepository,
} from './chat-conversation.repositories';
import {
  AI_ARMAN_CHAT_CONTRACT_VERSION,
  AI_ARMAN_CONVERSATION_STATE_VERSION,
  type AiArmanChatRequest,
  type AiArmanChatResponse,
} from './chat-messages.types';

const USER: User = {
  id: 42,
  name: 'Customer',
  email: 'customer@example.com',
  role: UserRole.USER,
};

function request(text: string, clientMessageId = 'client-1'): AiArmanChatRequest {
  return {
    contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
    conversationId: 'conversation_123',
    clientMessageId,
    message: { text },
  };
}

function returnsResponse(intent: 'return_help' | 'claim_help' = 'return_help'): AiArmanChatResponse {
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
        orderReference: '90250',
        productReferences: [],
        recommendationDomain: null,
        skincareRoutineActives: [],
      },
      missingFields: [],
      requiresIdentity: true,
      requiresHumanReview: false,
    },
    state: {
      stateVersion: AI_ARMAN_CONVERSATION_STATE_VERSION,
      conversationId: 'conversation_123',
      status: 'ready_for_tools',
      activeJourney: 'customer_service',
      locale: 'sv-SE',
      identityLevel: 'anonymous',
      remembered: {
        requestedProductTypes: [],
        needs: [],
        exclusions: [],
        orderReference: '90250',
        productReferences: [],
        recommendationDomain: null,
        skincareRoutineActives: [],
      },
      pendingQuestion: null,
    },
    decision: {
      owner: 'backend_policy',
      route: 'returns_support',
      plannedTools: [],
      executionStatus: 'not_executed_foundation',
      requiresIdentity: true,
      requiresConfirmation: false,
      reasons: ['verified_identity_required_before_case_preparation'],
    },
    blocks: [{ type: 'message', text: 'Verifiering krävs.' }],
    safety: {
      aiModelUsed: false,
      liveFactsUsed: false,
      writesExecuted: false,
      productionActionsEnabled: false,
      htmlAcceptedFromModel: false,
    },
  };
}

function genericFollowUpResponse(): AiArmanChatResponse {
  const response = returnsResponse();
  response.interpretation.primaryIntent = 'unknown';
  response.interpretation.entities.orderReference = null;
  response.interpretation.requiresIdentity = false;
  response.decision.route = 'general';
  response.decision.requiresIdentity = false;
  response.decision.reasons = ['safe_general_response_without_tool_execution'];
  response.state.activeJourney = 'general';
  response.state.remembered.orderReference = null;
  return response;
}

function build(params?: {
  response?: AiArmanChatResponse;
  responses?: AiArmanChatResponse[];
  verifyAndBind?: jest.Mock;
  getCaseStatus?: jest.Mock;
  getCaseMessages?: jest.Mock;
}) {
  const response = params?.response || returnsResponse();
  const handleWithShadow = jest.fn();
  if (params?.responses?.length) {
    for (const item of params.responses) {
      handleWithShadow.mockResolvedValueOnce(item);
    }
  } else {
    handleWithShadow.mockResolvedValue(response);
  }
  const chat = {
    handleWithShadow,
  } as unknown as SkincareSpecialistChatOrchestrator;
  const verifyAndBind =
    params?.verifyAndBind ||
    jest.fn().mockResolvedValue({
      ok: true,
      conversationId: 'conversation_123',
      orderId: '90250',
      expiresAt: '2026-08-13T10:15:00.000Z',
    });
  const access = {
    verifyAndBind,
  } as unknown as AuthenticatedAccountOrderAccessService;
  const getCaseStatus = params?.getCaseStatus || jest.fn();
  const getCaseMessages = params?.getCaseMessages || jest.fn();
  const read = {
    getCaseStatus,
    getCaseMessages,
  } as unknown as VerifiedReturnsReadService;
  const resultStore = {
    get: jest.fn().mockReturnValue({ fingerprint: 'fp', response }),
    save: jest.fn((_key, _fingerprint, value) => value),
  } as unknown as ChatConversationResultRepository;
  const stateStore = {
    get: jest.fn(),
    save: jest.fn((value) => value),
  } as unknown as ChatConversationStateRepository;

  return {
    service: new AuthenticatedAfterPurchaseChatOrchestrator(
      chat,
      access,
      read,
      resultStore,
      stateStore,
    ),
    verifyAndBind,
    getCaseStatus,
    getCaseMessages,
  };
}

describe('AuthenticatedAfterPurchaseChatOrchestrator', () => {
  it('verifies the authenticated account before the first returns read and then returns case status', async () => {
    const getCaseStatus = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, error: 'verification_not_found' })
      .mockResolvedValueOnce({
        ok: true,
        caseId: 'HQR-123456',
        orderId: '90250',
        caseType: 'return',
        status: 'return_received',
        statusLabel: 'Retur mottagen',
        updatedAt: '2026-08-13T09:00:00.000Z',
      });
    const { service, verifyAndBind } = build({ getCaseStatus });

    const result = await service.handle(
      request('Vad är status på min retur order 90250?'),
      USER,
    );

    expect(verifyAndBind).toHaveBeenCalledWith({
      user: USER,
      conversationId: 'conversation_123',
      orderId: '90250',
    });
    expect(getCaseStatus).toHaveBeenCalledTimes(2);
    expect(result.decision.executionStatus).toBe('executed_read_only');
    expect(result.decision.plannedTools).toEqual(['get_case_status']);
    expect(result.safety.writesExecuted).toBe(false);
    expect(result.safety.productionActionsEnabled).toBe(false);
    expect(result.blocks[0]).toMatchObject({
      type: 'message',
      text: expect.stringContaining('HQR-123456'),
    });
  });

  it('fails closed when Vendre rejects ownership and never reads Returns Module afterward', async () => {
    const getCaseStatus = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, error: 'verification_not_found' });
    const verifyAndBind = jest.fn().mockResolvedValue({
      ok: false,
      error: 'verification_rejected',
    });
    const { service, getCaseMessages } = build({
      getCaseStatus,
      verifyAndBind,
    });

    const result = await service.handle(
      request('Vad är status på min reklamation order 90250?'),
      USER,
    );

    expect(getCaseStatus).toHaveBeenCalledTimes(1);
    expect(getCaseMessages).not.toHaveBeenCalled();
    expect(result.decision.executionStatus).toBe('failed_closed');
    expect(result.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'error_notice',
          code: 'order_ownership_not_verified',
        }),
      ]),
    );
  });

  it('reads public case messages only after verified case status identifies the exact case', async () => {
    const getCaseStatus = jest.fn().mockResolvedValue({
      ok: true,
      caseId: 'HQR-123456',
      orderId: '90250',
      caseType: 'claim',
      status: 'claim_review',
      statusLabel: 'Under granskning',
      updatedAt: '2026-08-13T09:00:00.000Z',
    });
    const getCaseMessages = jest.fn().mockResolvedValue({
      ok: true,
      caseId: 'HQR-123456',
      orderId: '90250',
      messages: [
        {
          id: 'm1',
          direction: 'outbound',
          sender: 'HARMONIQ',
          subject: 'Reklamation HQR-123456',
          text: 'Vi granskar ditt ärende.',
          date: '2026-08-13T08:30:00.000Z',
        },
      ],
    });
    const { service, verifyAndBind } = build({
      response: returnsResponse('claim_help'),
      getCaseStatus,
      getCaseMessages,
    });

    const result = await service.handle(
      request('Visa senaste meddelandena i min reklamation order 90250'),
      USER,
    );

    expect(verifyAndBind).not.toHaveBeenCalled();
    expect(getCaseMessages).toHaveBeenCalledWith({
      conversationId: 'conversation_123',
      userId: 42,
      orderId: '90250',
      caseId: 'HQR-123456',
    });
    expect(result.decision.executionStatus).toBe('executed_read_only');
    expect(result.decision.plannedTools).toEqual([
      'get_case_status',
      'get_case_messages',
    ]);
    expect(result.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'message',
          text: expect.stringContaining('Vi granskar ditt ärende.'),
        }),
      ]),
    );
  });

  it('continues a verified returns conversation when a later message only asks what was written last', async () => {
    const getCaseStatus = jest.fn().mockResolvedValue({
      ok: true,
      caseId: 'HQR-123456',
      orderId: '90250',
      caseType: 'return',
      status: 'return_received',
      statusLabel: 'Retur mottagen',
      updatedAt: '2026-08-13T09:00:00.000Z',
    });
    const getCaseMessages = jest.fn().mockResolvedValue({
      ok: true,
      caseId: 'HQR-123456',
      orderId: '90250',
      messages: [
        {
          id: 'm1',
          direction: 'outbound',
          sender: 'HARMONIQ',
          subject: 'Retur HQR-123456',
          text: 'Din retur är registrerad.',
          date: '2026-08-13T08:30:00.000Z',
        },
      ],
    });
    const { service, verifyAndBind } = build({
      responses: [returnsResponse(), genericFollowUpResponse()],
      getCaseStatus,
      getCaseMessages,
    });

    await service.handle(
      request('Vad är status på min retur order 90250?', 'client-1'),
      USER,
    );
    const followUp = await service.handle(
      request('Vad skrev ni senast?', 'client-2'),
      USER,
    );

    expect(verifyAndBind).not.toHaveBeenCalled();
    expect(getCaseStatus).toHaveBeenLastCalledWith({
      conversationId: 'conversation_123',
      userId: 42,
      orderId: '90250',
      caseId: 'HQR-123456',
    });
    expect(getCaseMessages).toHaveBeenCalledWith({
      conversationId: 'conversation_123',
      userId: 42,
      orderId: '90250',
      caseId: 'HQR-123456',
    });
    expect(followUp.decision.route).toBe('returns_support');
    expect(followUp.decision.plannedTools).toEqual([
      'get_case_status',
      'get_case_messages',
    ]);
    expect(followUp.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'message',
          text: expect.stringContaining('Din retur är registrerad.'),
        }),
      ]),
    );
  });

  it('does not reuse remembered returns context for another authenticated user', async () => {
    const getCaseStatus = jest.fn().mockResolvedValue({
      ok: true,
      caseId: 'HQR-123456',
      orderId: '90250',
      caseType: 'return',
      status: 'return_received',
      statusLabel: 'Retur mottagen',
      updatedAt: '2026-08-13T09:00:00.000Z',
    });
    const { service } = build({
      responses: [returnsResponse(), genericFollowUpResponse()],
      getCaseStatus,
    });

    await service.handle(
      request('Vad är status på min retur order 90250?', 'client-1'),
      USER,
    );
    const otherUser = { ...USER, id: 43, email: 'other@example.com' };
    const followUp = await service.handle(
      request('Vad är status nu?', 'client-2'),
      otherUser,
    );

    expect(getCaseStatus).toHaveBeenCalledTimes(1);
    expect(followUp.decision.route).toBe('general');
    expect(followUp.safety.liveFactsUsed).toBe(false);
  });

  it('does not carry a remembered case id into an explicit different order', async () => {
    const firstResponse = returnsResponse();
    const secondResponse = returnsResponse();
    secondResponse.interpretation.entities.orderReference = '90251';
    secondResponse.state.remembered.orderReference = '90251';
    const getCaseStatus = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        caseId: 'HQR-123456',
        orderId: '90250',
        caseType: 'return',
        status: 'return_received',
        statusLabel: 'Retur mottagen',
        updatedAt: '2026-08-13T09:00:00.000Z',
      })
      .mockResolvedValueOnce({
        ok: true,
        caseId: 'HQR-654321',
        orderId: '90251',
        caseType: 'return',
        status: 'return_requested',
        statusLabel: 'Retur registrerad',
        updatedAt: '2026-08-13T10:00:00.000Z',
      });
    const { service } = build({
      responses: [firstResponse, secondResponse],
      getCaseStatus,
    });

    await service.handle(
      request('Vad är status på min retur order 90250?', 'client-1'),
      USER,
    );
    await service.handle(
      request('Och retur order 90251?', 'client-2'),
      USER,
    );

    expect(getCaseStatus).toHaveBeenLastCalledWith({
      conversationId: 'conversation_123',
      userId: 42,
      orderId: '90251',
    });
  });

  it('does not reverify through a different authenticated actor when an existing binding belongs to someone else', async () => {
    const getCaseStatus = jest
      .fn()
      .mockResolvedValue({ ok: false, error: 'verification_actor_mismatch' });
    const { service, verifyAndBind } = build({ getCaseStatus });

    const result = await service.handle(
      request('Vad är status på min retur order 90250?'),
      USER,
    );

    expect(verifyAndBind).not.toHaveBeenCalled();
    expect(result.decision.executionStatus).toBe('failed_closed');
    expect(result.decision.reasons).toContain(
      'verified_returns_read:verification_actor_mismatch',
    );
  });

  it('never runs return reads from a non-returns chat intent without remembered context', async () => {
    const response = returnsResponse();
    response.interpretation.primaryIntent = 'order_status';
    response.decision.route = 'order_support';
    const { service, verifyAndBind, getCaseStatus } = build({ response });

    const result = await service.handle(request('Order 90250'), USER);

    expect(result).toBe(response);
    expect(verifyAndBind).not.toHaveBeenCalled();
    expect(getCaseStatus).not.toHaveBeenCalled();
  });
});
