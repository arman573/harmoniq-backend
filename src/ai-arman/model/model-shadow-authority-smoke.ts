import { NestFactory } from '@nestjs/core';
import { AiArmanModule } from '../ai-arman.module';
import { ChatConversationService } from '../chat/chat-conversation.service';
import { InMemoryChatInterpretationShadowAuditStore } from '../chat/chat-interpretation-shadow-audit.store';
import { ChatInterpretationShadowConfig } from '../chat/chat-interpretation-shadow.config';
import { readChatInterpretationPromotionConfig } from '../chat/chat-interpretation-promotion.config';
import { AI_ARMAN_CHAT_CONTRACT_VERSION } from '../chat/chat-messages.types';

const EXIT = {
  unsafeConfig: 51,
  deterministicAuthorityLost: 53,
  unsafeResponse: 54,
  shadowDisabled: 60,
  providerNotConfigured: 61,
  providerRateLimited: 62,
  providerConcurrencyLimited: 63,
  providerBudgetExceeded: 64,
  providerTimeout: 65,
  providerAuthentication: 66,
  providerQuota: 67,
  providerUnavailable: 68,
  providerInvalidResponse: 69,
  providerError: 70,
  auditMissing: 71,
  unexpected: 79,
} as const;

const PROVIDER_STATUS_EXIT: Record<string, number> = {
  disabled: EXIT.shadowDisabled,
  provider_not_configured: EXIT.providerNotConfigured,
  provider_rate_limited: EXIT.providerRateLimited,
  provider_concurrency_limited: EXIT.providerConcurrencyLimited,
  provider_budget_exceeded: EXIT.providerBudgetExceeded,
  provider_timeout: EXIT.providerTimeout,
  provider_authentication: EXIT.providerAuthentication,
  provider_quota: EXIT.providerQuota,
  provider_unavailable: EXIT.providerUnavailable,
  provider_invalid_response: EXIT.providerInvalidResponse,
  provider_error: EXIT.providerError,
};

async function main() {
  const app = await NestFactory.createApplicationContext(AiArmanModule, {
    logger: false,
  });

  try {
    const conversation = app.get(ChatConversationService);
    const auditStore = app.get(InMemoryChatInterpretationShadowAuditStore);
    const shadowConfig = app.get(ChatInterpretationShadowConfig);
    const promotionConfig = readChatInterpretationPromotionConfig();

    if (
      process.env.AI_ARMAN_MODEL_INTERPRETATION_ENABLED !== 'true' ||
      !shadowConfig.isEnabled() ||
      promotionConfig.enabled
    ) {
      console.error('MODEL_SHADOW_AUTHORITY_SMOKE=FAIL code=unsafe_config');
      process.exitCode = EXIT.unsafeConfig;
      return;
    }

    const response = await conversation.handleWithShadow({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      conversationId: 'synthetic-shadow-authority-smoke',
      clientMessageId: 'synthetic-shadow-authority-smoke-1',
      message: {
        text: 'Hej!',
      },
      context: {
        locale: 'sv-SE',
        channel: 'internal_preview',
      },
    });

    const audits = auditStore.snapshot();
    const latest = audits.at(-1);

    if (!latest) {
      console.error('MODEL_SHADOW_AUTHORITY_SMOKE=FAIL code=audit_missing');
      process.exitCode = EXIT.auditMissing;
      return;
    }

    if (latest.status !== 'completed') {
      console.error(`MODEL_SHADOW_AUTHORITY_SMOKE=FAIL code=${latest.status}`);
      process.exitCode = PROVIDER_STATUS_EXIT[latest.status] ?? EXIT.unexpected;
      return;
    }

    if (
      response.interpretation.source !== 'deterministic_fallback' ||
      response.safety.aiModelUsed !== false ||
      response.decision.owner !== 'backend_policy'
    ) {
      console.error(
        'MODEL_SHADOW_AUTHORITY_SMOKE=FAIL code=deterministic_authority_lost',
      );
      process.exitCode = EXIT.deterministicAuthorityLost;
      return;
    }

    if (
      response.safety.writesExecuted !== false ||
      response.safety.productionActionsEnabled !== false ||
      response.safety.htmlAcceptedFromModel !== false
    ) {
      console.error('MODEL_SHADOW_AUTHORITY_SMOKE=FAIL code=unsafe_response');
      process.exitCode = EXIT.unsafeResponse;
      return;
    }

    console.log('MODEL_SHADOW_AUTHORITY_SMOKE=PASS');
    console.log('MODEL_SHADOW_PROVIDER_STATUS=completed');
    console.log('MODEL_SHADOW_PROMOTION_ENABLED=false');
    console.log('DETERMINISTIC_RESPONSE_AUTHORITY=PASS');
    console.log('MODEL_USED_IN_CUSTOMER_RESPONSE=false');
    console.log('BACKEND_POLICY_OWNER=PASS');
    console.log('PRODUCTION_ACTIONS_ENABLED=false');
    console.log('WRITES_EXECUTED=false');
    console.log(`MODEL_SHADOW_INPUT_TOKENS=${latest.inputTokens ?? 'unknown'}`);
    console.log(`MODEL_SHADOW_OUTPUT_TOKENS=${latest.outputTokens ?? 'unknown'}`);
    console.log(`MODEL_SHADOW_TOTAL_TOKENS=${latest.totalTokens ?? 'unknown'}`);
    console.log(
      `MODEL_SHADOW_ESTIMATED_COST_USD=${latest.estimatedCostUsd?.toFixed(6) ?? 'unknown'}`,
    );
    console.log(`MODEL_SHADOW_CANDIDATE_VALID=${latest.candidateValid ?? 'unknown'}`);
    console.log(
      `MODEL_SHADOW_PRIMARY_INTENT_MATCH=${latest.primaryIntentMatch ?? 'unknown'}`,
    );
  } finally {
    await app.close();
  }
}

main().catch(() => {
  console.error('MODEL_SHADOW_AUTHORITY_SMOKE=FAIL code=unexpected_error');
  process.exit(EXIT.unexpected);
});
