import { NotFoundException } from '@nestjs/common';
import type { ChatConversationService } from '../chat/chat-conversation.service';
import type { ChatInterpretationShadowOrchestrator } from '../chat/chat-interpretation-shadow-orchestrator.service';
import type { AiArmanChatRequest, AiArmanChatResponse } from '../chat/chat-messages.types';
import { AiArmanInternalPreviewDiagnosticsConfig } from './ai-arman-internal-preview-diagnostics.config';
import { AiArmanInternalPreviewDiagnosticsService } from './ai-arman-internal-preview-diagnostics.service';

const request: AiArmanChatRequest = {
  contractVersion: 'ai-arman-chat-v1',
  clientMessageId: 'preview-test-1',
  message: { text: 'Jag söker schampo för torrt hår' },
  context: { locale: 'sv-SE', channel: 'internal_preview' },
};

const response: AiArmanChatResponse = {
  contractVersion: 'ai-arman-chat-v1',
  conversationId: 'conversation-preview-test',
  serverMessageId: 'message-preview-test',
  interpretation: {
    schemaVersion: 'ai-arman-interpretation-v1',
    source: 'deterministic_fallback',
    locale: 'sv-SE',
    primaryIntent: 'product_recommendation',
    secondaryIntents: [],
    confidence: 0.72,
    entities: {
      requestedProductTypes: ['shampoo'],
      needs: ['dry_lengths'],
      exclusions: [],
      orderReference: null,
      productReferences: [],
      recommendationDomain: 'haircare',
    },
    missingFields: [],
    requiresIdentity: false,
    requiresHumanReview: false,
  },
  state: {
    stateVersion: 'ai-arman-conversation-state-v1',
    conversationId: 'conversation-preview-test',
    status: 'ready_for_tools',
    activeJourney: 'before_purchase',
    locale: 'sv-SE',
    identityLevel: 'anonymous',
    remembered: {
      requestedProductTypes: ['shampoo'],
      needs: ['dry_lengths'],
      exclusions: [],
      orderReference: null,
      productReferences: [],
      recommendationDomain: 'haircare',
    },
    pendingQuestion: null,
  },
  decision: {
    owner: 'backend_policy',
    route: 'recommendation',
    plannedTools: [],
    executionStatus: 'not_executed_foundation',
    requiresIdentity: false,
    requiresConfirmation: false,
    reasons: ['test'],
  },
  blocks: [{ type: 'message', text: 'Säkert backendsvar' }],
  safety: {
    aiModelUsed: false,
    liveFactsUsed: false,
    writesExecuted: false,
    productionActionsEnabled: false,
    htmlAcceptedFromModel: false,
  },
};

function service(enabled = true) {
  const config = {
    isEnabled: jest.fn(() => enabled),
  } as unknown as AiArmanInternalPreviewDiagnosticsConfig;
  const conversations = {
    handle: jest.fn(() => response),
  } as unknown as ChatConversationService;
  const shadowOrchestrator = {
    run: jest.fn(async () => ({
      status: 'completed' as const,
      comparison: {
        status: 'valid_candidate' as const,
        candidateSource: 'model_candidate' as const,
        candidatePrimaryIntent: 'product_recommendation' as const,
        candidateConfidence: 0.91,
        primaryIntentMatch: true,
        secondaryIntentOverlap: 1,
        requestedProductTypeOverlap: 1,
        needOverlap: 1,
        exclusionOverlap: 1,
        orderReferenceMatch: true,
        requiresIdentityMatch: true,
        requiresHumanReviewMatch: true,
        confidenceDelta: 0.19,
        affectsCustomerResponse: false as const,
        affectsState: false as const,
        affectsTools: false as const,
      },
      promotion: null,
      usage: {
        inputTokens: 100,
        outputTokens: 20,
        totalTokens: 120,
        estimatedCostUsd: 0.001,
      },
    })),
  } as unknown as ChatInterpretationShadowOrchestrator;

  return {
    diagnostics: new AiArmanInternalPreviewDiagnosticsService(
      config,
      conversations,
      shadowOrchestrator,
    ),
    conversations,
    shadowOrchestrator,
  };
}

describe('AiArmanInternalPreviewDiagnosticsService', () => {
  const previousPromotion = process.env.AI_ARMAN_MODEL_PROMOTION_ENABLED;

  afterEach(() => {
    if (previousPromotion === undefined) {
      delete process.env.AI_ARMAN_MODEL_PROMOTION_ENABLED;
    } else {
      process.env.AI_ARMAN_MODEL_PROMOTION_ENABLED = previousPromotion;
    }
  });

  it('is disabled unless the diagnostics flag is explicitly enabled', () => {
    const config = new AiArmanInternalPreviewDiagnosticsConfig();
    expect(config.isEnabled({})).toBe(false);
    expect(config.isEnabled({ AI_ARMAN_INTERNAL_PREVIEW_DIAGNOSTICS_ENABLED: 'TRUE' })).toBe(false);
    expect(config.isEnabled({ AI_ARMAN_INTERNAL_PREVIEW_DIAGNOSTICS_ENABLED: 'true' })).toBe(true);
  });

  it('returns 404 while diagnostics are disabled', async () => {
    const { diagnostics, conversations, shadowOrchestrator } = service(false);

    await expect(diagnostics.inspect(request)).rejects.toThrow(NotFoundException);
    expect(conversations.handle).not.toHaveBeenCalled();
    expect(shadowOrchestrator.run).not.toHaveBeenCalled();
  });

  it('returns 404 for a normal web widget even when diagnostics are enabled', async () => {
    const { diagnostics, conversations, shadowOrchestrator } = service(true);
    const webWidgetRequest: AiArmanChatRequest = {
      ...request,
      context: { locale: 'sv-SE', channel: 'web_widget' },
    };

    await expect(diagnostics.inspect(webWidgetRequest)).rejects.toThrow(NotFoundException);
    expect(conversations.handle).not.toHaveBeenCalled();
    expect(shadowOrchestrator.run).not.toHaveBeenCalled();
  });

  it('returns only safe allowlisted diagnostics for internal preview', async () => {
    process.env.AI_ARMAN_MODEL_PROMOTION_ENABLED = 'false';
    const { diagnostics } = service(true);

    const result = await diagnostics.inspect(request);

    expect(result).toEqual(
      expect.objectContaining({
        diagnosticsVersion: 'ai-arman-internal-preview-diagnostics-v1',
        deterministic: expect.objectContaining({
          primaryIntent: 'product_recommendation',
          backendRoute: 'recommendation',
          backendAuthority: 'backend_policy',
        }),
        modelShadow: expect.objectContaining({
          providerStatus: 'completed',
          primaryIntent: 'product_recommendation',
          confidence: 0.91,
          primaryIntentMatch: true,
          totalTokens: 120,
          estimatedCostUsd: 0.001,
        }),
        safety: expect.objectContaining({
          promotionEnabled: false,
          modelAffectsCustomerResponse: false,
          modelAffectsState: false,
          modelAffectsTools: false,
          writesExecuted: false,
          productionActionsEnabled: false,
          rawModelTextExposed: false,
          promptExposed: false,
        }),
      }),
    );

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('systemPrompt');
    expect(serialized).not.toContain('rawModelText');
    expect(serialized).not.toContain('promptVersion');
    expect(serialized).not.toContain('modelVersion');
    expect(serialized).not.toContain('provider:');
  });
});
