import { Injectable, NotFoundException } from '@nestjs/common';
import { readChatInterpretationPromotionConfig } from '../chat/chat-interpretation-promotion.config';
import { ChatInterpretationShadowOrchestrator } from '../chat/chat-interpretation-shadow-orchestrator.service';
import { ChatConversationService } from '../chat/chat-conversation.service';
import type { AiArmanChatRequest } from '../chat/chat-messages.types';
import { AiArmanInternalPreviewDiagnosticsConfig } from './ai-arman-internal-preview-diagnostics.config';

@Injectable()
export class AiArmanInternalPreviewDiagnosticsService {
  constructor(
    private readonly config: AiArmanInternalPreviewDiagnosticsConfig,
    private readonly conversations: ChatConversationService,
    private readonly shadowOrchestrator: ChatInterpretationShadowOrchestrator,
  ) {}

  async inspect(input: AiArmanChatRequest) {
    if (!this.config.isEnabled() || input.context?.channel !== 'internal_preview') {
      throw new NotFoundException();
    }

    const response = this.conversations.handle(input);
    const shadow = await this.shadowOrchestrator.run(response.interpretation, {
      text: input.message.text,
      locale: 'sv-SE',
      previousState: null,
    });

    const completed = shadow.status === 'completed' ? shadow : null;
    const comparison = completed?.comparison ?? null;
    const usage = completed?.usage ?? null;

    return {
      diagnosticsVersion: 'ai-arman-internal-preview-diagnostics-v1',
      deterministic: {
        primaryIntent: response.interpretation.primaryIntent,
        confidence: response.interpretation.confidence,
        source: response.interpretation.source,
        backendRoute: response.decision.route,
        backendAuthority: response.decision.owner,
        executionStatus: response.decision.executionStatus,
      },
      modelShadow: {
        providerStatus: shadow.status,
        candidateStatus: comparison?.status ?? null,
        primaryIntent: comparison?.candidatePrimaryIntent ?? null,
        confidence: comparison?.candidateConfidence ?? null,
        primaryIntentMatch: comparison?.primaryIntentMatch ?? null,
        secondaryIntentOverlap: comparison?.secondaryIntentOverlap ?? null,
        requestedProductTypeOverlap: comparison?.requestedProductTypeOverlap ?? null,
        needOverlap: comparison?.needOverlap ?? null,
        exclusionOverlap: comparison?.exclusionOverlap ?? null,
        inputTokens: usage?.inputTokens ?? null,
        outputTokens: usage?.outputTokens ?? null,
        totalTokens: usage?.totalTokens ?? null,
        estimatedCostUsd: usage?.estimatedCostUsd ?? null,
      },
      safety: {
        promotionEnabled: readChatInterpretationPromotionConfig().enabled,
        modelAffectsCustomerResponse: comparison?.affectsCustomerResponse ?? false,
        modelAffectsState: comparison?.affectsState ?? false,
        modelAffectsTools: comparison?.affectsTools ?? false,
        writesExecuted: response.safety.writesExecuted,
        productionActionsEnabled: response.safety.productionActionsEnabled,
        modelOutputExposed: false,
        promptExposed: false,
      },
      response: {
        contractVersion: response.contractVersion,
        conversationId: response.conversationId,
        blocks: response.blocks,
      },
    };
  }
}
