import type { User } from '../../users/user.entity';
import { UserRole } from '../../users/user.entity';
import type { AuthenticatedAccountOrderAccessService } from '../identity/authenticated-account-order-access.service';
import type { VerifiedOrderReadService } from '../integrations/verified-order-read.service';
import type { VerifiedReturnsReadService } from '../integrations/verified-returns-read.service';
import type { VerifiedTrackingReadService } from '../integrations/verified-tracking-read.service';
import { SkincareSpecialistChatOrchestrator } from '../skincare/skincare-specialist-chat-orchestrator.service';
import { AuthenticatedAfterPurchaseChatOrchestrator } from './authenticated-after-purchase-chat-orchestrator.service';
import { AuthenticatedCustomerChatOrchestrator } from './authenticated-customer-chat-orchestrator.service';
import { ChatConversationResultStore } from './chat-conversation-result.store';
import { ChatConversationStateStore } from './chat-conversation-state.store';
import { ChatConversationService } from './chat-conversation.service';
import { ChatMessagesService } from './chat-messages.service';
import {
  AI_ARMAN_CHAT_CONTRACT_VERSION,
  type AiArmanChatRequest,
} from './chat-messages.types';

const USER: User = {
  id: 42,
  name: 'Customer',
  email: 'customer@example.com',
  role: UserRole.USER,
};

function request(
  text: string,
  clientMessageId: string,
  conversationId?: string,
): AiArmanChatRequest {
  return {
    contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
    ...(conversationId ? { conversationId } : {}),
    clientMessageId,
    message: { text },
  };
}

function trackingSuccess() {
  return {
    ok: true as const,
    tracking: {
      orderId: '90250',
      deliveryMethod: 'DB Schenker',
      deliveryType: 'schenker' as const,
      carrier: 'DB Schenker',
      shipmentStatus: 'På väg',
      trackingUrl: 'https://www.dbschenker.com/app/tracking-public?refNumber=ABC123',
      parcelNo: 'ABC123',
      available: true,
      message: null,
    },
  };
}

function build() {
  const stateStore = new ChatConversationStateStore();
  const resultStore = new ChatConversationResultStore();
  const messages = new ChatMessagesService();
  const conversations = new ChatConversationService(
    messages,
    stateStore,
    resultStore,
  );
  const skincare = new SkincareSpecialistChatOrchestrator(
    conversations,
    stateStore,
  );

  const verifyAndBind = jest.fn().mockImplementation(async (input) => ({
    ok: true,
    conversationId: input.conversationId,
    orderId: input.orderId,
    expiresAt: 'future',
  }));
  const accountAccess = {
    verifyAndBind,
  } as unknown as AuthenticatedAccountOrderAccessService;

  const getCaseStatus = jest.fn();
  const getCaseMessages = jest.fn();
  const verifiedReturnsRead = {
    getCaseStatus,
    getCaseMessages,
  } as unknown as VerifiedReturnsReadService;
  const afterPurchase = new AuthenticatedAfterPurchaseChatOrchestrator(
    skincare,
    accountAccess,
    verifiedReturnsRead,
    resultStore,
    stateStore,
  );

  const getOrder = jest.fn();
  const verifiedOrderRead = {
    getOrder,
  } as unknown as VerifiedOrderReadService;

  const getTracking = jest
    .fn()
    .mockResolvedValueOnce({ ok: false, error: 'verification_not_found' })
    .mockResolvedValue(trackingSuccess());
  const verifiedTrackingRead = {
    getTracking,
  } as unknown as VerifiedTrackingReadService;

  return {
    service: new AuthenticatedCustomerChatOrchestrator(
      afterPurchase,
      accountAccess,
      verifiedOrderRead,
      verifiedTrackingRead,
      resultStore,
      stateStore,
    ),
    verifyAndBind,
    getTracking,
    getOrder,
    getCaseStatus,
    getCaseMessages,
  };
}

describe('authenticated tracking flow integration', () => {
  it('routes real Swedish package text through verified tracking and returns a tracking card', async () => {
    const built = build();

    const result = await built.service.handle(
      request('Var är mitt paket för order 90250?', 'tracking-1'),
      USER,
    );

    expect(result.interpretation.primaryIntent).toBe('tracking_status');
    expect(result.interpretation.entities.orderReference).toBe('90250');
    expect(result.decision.route).toBe('order_support');
    expect(result.decision.plannedTools).toEqual(['get_tracking_status']);
    expect(result.decision.executionStatus).toBe('executed_read_only');
    expect(result.decision.requiresIdentity).toBe(true);
    expect(result.decision.reasons).toContain(
      'verified_tracking_read:tracking_status',
    );
    expect(result.blocks).toContainEqual({
      type: 'tracking_card',
      orderNumber: '90250',
      carrier: 'DB Schenker',
      trackingStatus: 'På väg',
      trackingLabel: 'På väg',
      trackingUrl:
        'https://www.dbschenker.com/app/tracking-public?refNumber=ABC123',
      updatedAt: expect.any(String),
    });
    expect(result.safety.liveFactsUsed).toBe(true);
    expect(result.safety.writesExecuted).toBe(false);
    expect(result.safety.productionActionsEnabled).toBe(false);

    expect(built.verifyAndBind).toHaveBeenCalledTimes(1);
    expect(built.verifyAndBind).toHaveBeenCalledWith({
      user: USER,
      conversationId: result.conversationId,
      orderId: '90250',
    });
    expect(built.getTracking).toHaveBeenCalledTimes(2);
    expect(built.getOrder).not.toHaveBeenCalled();
    expect(built.getCaseStatus).not.toHaveBeenCalled();
    expect(built.getCaseMessages).not.toHaveBeenCalled();
  });

  it('reuses the verified order for a natural tracking follow-up in the same user conversation', async () => {
    const built = build();

    const first = await built.service.handle(
      request('Var är mitt paket för order 90250?', 'tracking-1'),
      USER,
    );
    const followUp = await built.service.handle(
      request(
        'Har paketet kommit längre nu?',
        'tracking-2',
        first.conversationId,
      ),
      USER,
    );

    expect(followUp.interpretation.primaryIntent).toBe('tracking_status');
    expect(followUp.interpretation.entities.orderReference).toBe('90250');
    expect(followUp.decision.plannedTools).toEqual(['get_tracking_status']);
    expect(followUp.decision.executionStatus).toBe('executed_read_only');
    expect(followUp.blocks.some((block) => block.type === 'tracking_card')).toBe(true);
    expect(built.verifyAndBind).toHaveBeenCalledTimes(1);
    expect(built.getTracking).toHaveBeenCalledTimes(3);
  });

  it('does not let another authenticated user inherit the remembered order', async () => {
    const built = build();

    const first = await built.service.handle(
      request('Var är mitt paket för order 90250?', 'tracking-1'),
      USER,
    );

    const otherUser: User = {
      ...USER,
      id: 43,
      email: 'other@example.com',
    };
    const followUp = await built.service.handle(
      request(
        'Har paketet kommit längre nu?',
        'tracking-2',
        first.conversationId,
      ),
      otherUser,
    );

    expect(followUp.interpretation.primaryIntent).toBe('tracking_status');
    expect(followUp.interpretation.missingFields).toContain(
      'verifiedOrderIdentity',
    );
    expect(followUp.decision.executionStatus).toBe('not_executed_foundation');
    expect(followUp.safety.liveFactsUsed).toBe(false);
    expect(built.getTracking).toHaveBeenCalledTimes(2);
    expect(built.verifyAndBind).toHaveBeenCalledTimes(1);
  });
});
