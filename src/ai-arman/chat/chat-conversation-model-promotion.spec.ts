import { ChatConversationResultStore } from './chat-conversation-result.store';
import { ChatConversationStateStore } from './chat-conversation-state.store';
import { ChatConversationService } from './chat-conversation.service';
import type { ChatInterpretationShadowOrchestrator } from './chat-interpretation-shadow-orchestrator.service';
import { ChatMessagesService } from './chat-messages.service';
import { AI_ARMAN_CHAT_CONTRACT_VERSION } from './chat-messages.types';

function createService(run: jest.Mock) {
  return new ChatConversationService(
    new ChatMessagesService(),
    new ChatConversationStateStore(),
    new ChatConversationResultStore(),
    { run } as unknown as ChatInterpretationShadowOrchestrator,
  );
}

describe('ChatConversationService guarded model promotion', () => {
  it('promotes tracking semantics but still requires verified identity before any tool', async () => {
    const run = jest.fn().mockResolvedValue({
      status: 'completed',
      comparison: {
        status: 'valid_candidate',
      },
      promotion: {
        status: 'promote',
        proposal: {
          primaryIntent: 'tracking_status',
          secondaryIntents: [],
          confidence: 0.97,
          requestedProductTypes: [],
          recommendationDomain: null,
        },
        reasons: ['model_candidate_validated'],
      },
      usage: {
        inputTokens: 40,
        outputTokens: 20,
        totalTokens: 60,
        estimatedCostUsd: null,
      },
    });
    const service = createService(run);

    const response = await service.handleWithShadow({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'promotion-tracking-1',
      message: { text: 'Hur går det med försändelsen?' },
    });

    expect(response.interpretation).toMatchObject({
      source: 'model_promoted',
      primaryIntent: 'tracking_status',
      requiresIdentity: true,
      missingFields: ['verifiedOrderIdentity'],
      entities: {
        orderReference: null,
      },
    });
    expect(response.decision).toMatchObject({
      owner: 'backend_policy',
      route: 'order_support',
      requiresIdentity: true,
      plannedTools: [],
      executionStatus: 'not_executed_foundation',
    });
    expect(response.decision.reasons).toEqual(
      expect.arrayContaining([
        'verified_identity_required_before_get_tracking_status',
        'model_semantics_revalidated_by_backend',
      ]),
    );
    expect(response.state.status).toBe('collecting');
    expect(response.state.activeJourney).toBe('after_purchase');
    expect(response.state.pendingQuestion?.expectedField).toBe(
      'verifiedOrderIdentity',
    );
    expect(response.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'question',
          expectedField: 'verifiedOrderIdentity',
        }),
      ]),
    );
    expect(response.safety).toMatchObject({
      aiModelUsed: true,
      liveFactsUsed: false,
      writesExecuted: false,
      productionActionsEnabled: false,
    });
  });

  it('uses a promoted product type only with deterministic customer needs and backend tool policy', async () => {
    const run = jest.fn().mockResolvedValue({
      status: 'completed',
      comparison: {
        status: 'valid_candidate',
      },
      promotion: {
        status: 'promote',
        proposal: {
          primaryIntent: 'product_recommendation',
          secondaryIntents: [],
          confidence: 0.95,
          requestedProductTypes: ['shampoo'],
          recommendationDomain: 'haircare',
        },
        reasons: ['model_candidate_validated'],
      },
      usage: {
        inputTokens: 50,
        outputTokens: 20,
        totalTokens: 70,
        estimatedCostUsd: null,
      },
    });
    const service = createService(run);

    const response = await service.handleWithShadow({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      clientMessageId: 'promotion-product-1',
      message: { text: 'Mitt hår är slitet och frissigt. Vad hade du valt?' },
    });

    expect(response.interpretation).toMatchObject({
      source: 'model_promoted',
      primaryIntent: 'product_recommendation',
      entities: {
        requestedProductTypes: ['shampoo'],
        recommendationDomain: 'haircare',
      },
    });
    expect(response.interpretation.entities.needs).toEqual(
      expect.arrayContaining(['damaged_hair', 'frizz_control']),
    );
    expect(response.interpretation.entities.needs).not.toContain('thin_hair');
    expect(response.interpretation.entities.exclusions).toEqual([]);
    expect(response.decision).toMatchObject({
      owner: 'backend_policy',
      route: 'recommendation',
      plannedTools: [
        'search_products',
        'analyze_product_suitability',
        'get_product_live_facts',
      ],
      executionStatus: 'not_executed_foundation',
      requiresIdentity: false,
    });
    expect(response.safety.aiModelUsed).toBe(true);
    expect(response.safety.liveFactsUsed).toBe(false);
  });
});
