import { ConversationCustomerVerificationStore } from '../identity/conversation-customer-verification.store';
import { VerifiedCustomerContextStore } from '../identity/verified-customer-context.store';
import type { ReturnsModuleReadTools } from './returns-module-read.tools';
import { VerifiedReturnsReadService } from './verified-returns-read.service';

const NOW = new Date();

function setup() {
  const contexts = new VerifiedCustomerContextStore();
  const bindings = new ConversationCustomerVerificationStore();
  const getCaseStatus = jest.fn().mockResolvedValue({
    ok: true,
    caseId: 'HQR-1',
    orderId: '90250',
    caseType: 'return',
    status: 'open',
    statusLabel: 'Öppen',
    updatedAt: NOW.toISOString(),
  });
  const getCaseMessages = jest.fn().mockResolvedValue({
    ok: true,
    caseId: 'HQR-1',
    orderId: '90250',
    messages: [],
  });
  const tools = {
    getCaseStatus,
    getCaseMessages,
  } as unknown as ReturnsModuleReadTools;
  const service = new VerifiedReturnsReadService(bindings, contexts, tools);

  return { service, contexts, bindings, getCaseStatus, getCaseMessages };
}

function issueAndBind(
  contexts: VerifiedCustomerContextStore,
  bindings: ConversationCustomerVerificationStore,
) {
  const context = contexts.issue(
    {
      method: 'account_assertion',
      subject: 'customer@example.com',
      verifiedOrderIds: ['90250'],
    },
    NOW,
  );
  bindings.bind({
    conversationId: 'conversation_123',
    userId: 42,
    orderId: '90250',
    verificationId: context.verificationId,
    expiresAt: context.expiresAt,
  });
  return context;
}

describe('VerifiedReturnsReadService', () => {
  it('resolves the server-stored context before invoking a returns read tool', async () => {
    const { service, contexts, bindings, getCaseStatus } = setup();
    const context = issueAndBind(contexts, bindings);

    const result = await service.getCaseStatus({
      conversationId: 'conversation_123',
      userId: 42,
      orderId: '90250',
    });

    expect(result.ok).toBe(true);
    expect(getCaseStatus).toHaveBeenCalledWith({
      verification: context,
      orderId: '90250',
    });
  });

  it('rejects a random or missing conversation verification before tool execution', async () => {
    const { service, getCaseStatus } = setup();

    await expect(
      service.getCaseStatus({
        conversationId: 'conversation_missing',
        userId: 42,
        orderId: '90250',
      }),
    ).resolves.toEqual({ ok: false, error: 'verification_not_found' });
    expect(getCaseStatus).not.toHaveBeenCalled();
  });

  it('rejects a different authenticated actor before tool execution', async () => {
    const { service, contexts, bindings, getCaseStatus } = setup();
    issueAndBind(contexts, bindings);

    await expect(
      service.getCaseStatus({
        conversationId: 'conversation_123',
        userId: 99,
        orderId: '90250',
      }),
    ).resolves.toEqual({ ok: false, error: 'verification_actor_mismatch' });
    expect(getCaseStatus).not.toHaveBeenCalled();
  });

  it('rejects a different order before tool execution', async () => {
    const { service, contexts, bindings, getCaseMessages } = setup();
    issueAndBind(contexts, bindings);

    await expect(
      service.getCaseMessages({
        conversationId: 'conversation_123',
        userId: 42,
        orderId: '90251',
      }),
    ).resolves.toEqual({ ok: false, error: 'verification_order_mismatch' });
    expect(getCaseMessages).not.toHaveBeenCalled();
  });

  it('fails closed when the underlying verification context has been revoked', async () => {
    const { service, contexts, bindings, getCaseStatus } = setup();
    const context = issueAndBind(contexts, bindings);
    contexts.revoke(context.verificationId);

    await expect(
      service.getCaseStatus({
        conversationId: 'conversation_123',
        userId: 42,
        orderId: '90250',
      }),
    ).resolves.toEqual({ ok: false, error: 'verification_not_found' });
    expect(getCaseStatus).not.toHaveBeenCalled();
  });
});
