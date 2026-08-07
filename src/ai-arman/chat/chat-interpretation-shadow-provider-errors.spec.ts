import type { AiArmanConversationState } from './chat-messages.types';
import {
  ChatInterpretationProvider,
  ChatInterpretationProviderError,
  type AiArmanInterpretationProviderErrorCode,
  type AiArmanInterpretationProviderMetadata,
  type AiArmanInterpretationProviderResult,
} from './chat-interpretation.provider';
import { InMemoryChatInterpretationShadowAuditStore } from './chat-interpretation-shadow-audit.store';
import { ChatInterpretationShadowConfig } from './chat-interpretation-shadow.config';
import { ChatInterpretationShadowOrchestrator } from './chat-interpretation-shadow-orchestrator.service';
import { ChatInterpretationShadowService } from './chat-interpretation-shadow.service';
import { ChatInterpretationValidator } from './chat-interpretation.validator';
import type { AiArmanInterpretation } from './chat-messages.types';

const deterministic: AiArmanInterpretation = {
  schemaVersion: 'ai-arman-interpretation-v1',
  source: 'deterministic_fallback',
  locale: 'sv-SE',
  primaryIntent: 'product_recommendation',
  secondaryIntents: [],
  confidence: 0.7,
  entities: {
    requestedProductTypes: ['shampoo'],
    needs: ['dry_lengths'],
    exclusions: [],
    orderReference: null,
    productReferences: [],
  },
  missingFields: [],
  requiresIdentity: false,
  requiresHumanReview: false,
};

const input = {
  text: 'Jag behöver schampo',
  locale: 'sv-SE' as const,
  previousState: null as AiArmanConversationState | null,
};

class EnabledConfig extends ChatInterpretationShadowConfig {
  isEnabled(): boolean {
    return true;
  }
}

class FailingProvider extends ChatInterpretationProvider {
  constructor(private readonly code: AiArmanInterpretationProviderErrorCode) {
    super();
  }

  metadata(): AiArmanInterpretationProviderMetadata {
    return {
      provider: 'error-test',
      modelVersion: 'model-v1',
      promptVersion: 'prompt-v1',
    };
  }

  async interpret(): Promise<AiArmanInterpretationProviderResult> {
    throw new ChatInterpretationProviderError(this.code);
  }
}

function orchestrator(
  code: AiArmanInterpretationProviderErrorCode,
  audit?: InMemoryChatInterpretationShadowAuditStore,
) {
  return new ChatInterpretationShadowOrchestrator(
    new EnabledConfig(),
    new ChatInterpretationShadowService(new ChatInterpretationValidator()),
    new FailingProvider(code),
    audit,
  );
}

describe('ChatInterpretationShadowOrchestrator provider error classification', () => {
  it.each([
    ['authentication', 'provider_authentication'],
    ['quota', 'provider_quota'],
    ['unavailable', 'provider_unavailable'],
    ['invalid_response', 'provider_invalid_response'],
  ] as const)('maps %s to %s', async (code, status) => {
    await expect(orchestrator(code).run(deterministic, input)).resolves.toEqual({
      status,
      comparison: null,
    });
  });

  it('audits only the stable failure status without upstream error text', async () => {
    const audit = new InMemoryChatInterpretationShadowAuditStore();

    await orchestrator('authentication', audit).run(deterministic, input);

    const records = audit.snapshot();
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe('provider_authentication');
    expect(JSON.stringify(records[0])).not.toContain(
      'chat_interpretation_provider_error:authentication',
    );
  });
});
