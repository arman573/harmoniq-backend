import type { AiArmanConversationState } from './chat-messages.types';
import {
  ChatInterpretationProvider,
  type AiArmanInterpretationProviderMetadata,
  type AiArmanInterpretationProviderResult,
} from './chat-interpretation.provider';
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
    needs: [],
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

class ConcurrencyConfig extends ChatInterpretationShadowConfig {
  isEnabled(): boolean {
    return true;
  }

  override maxConcurrentProviderCalls(): number {
    return 2;
  }

  override providerTimeoutMs(): number {
    return 5_000;
  }
}

class DeferredProvider extends ChatInterpretationProvider {
  calls = 0;
  private readonly resolvers: Array<
    (result: AiArmanInterpretationProviderResult) => void
  > = [];

  metadata(): AiArmanInterpretationProviderMetadata {
    return {
      provider: 'concurrency-test',
      modelVersion: 'model-v1',
      promptVersion: 'prompt-v1',
    };
  }

  async interpret(): Promise<AiArmanInterpretationProviderResult> {
    this.calls += 1;
    return new Promise((resolve) => {
      this.resolvers.push(resolve);
    });
  }

  resolvePending(): void {
    const result: AiArmanInterpretationProviderResult = {
      candidate: {
        ...deterministic,
        source: 'model_candidate',
      },
      usage: {
        inputTokens: 20,
        outputTokens: 10,
      },
    };

    for (const resolve of this.resolvers.splice(0)) {
      resolve(result);
    }
  }
}

function shadowService() {
  return new ChatInterpretationShadowService(new ChatInterpretationValidator());
}

describe('ChatInterpretationShadowOrchestrator concurrency', () => {
  it('limits simultaneous provider calls and releases slots after completion', async () => {
    const provider = new DeferredProvider();
    const orchestrator = new ChatInterpretationShadowOrchestrator(
      new ConcurrencyConfig(),
      shadowService(),
      provider,
    );

    const first = orchestrator.run(deterministic, input);
    const second = orchestrator.run(deterministic, input);

    await expect(orchestrator.run(deterministic, input)).resolves.toEqual({
      status: 'provider_concurrency_limited',
      comparison: null,
    });
    expect(provider.calls).toBe(2);

    provider.resolvePending();
    await expect(first).resolves.toEqual(
      expect.objectContaining({ status: 'completed' }),
    );
    await expect(second).resolves.toEqual(
      expect.objectContaining({ status: 'completed' }),
    );

    const fourth = orchestrator.run(deterministic, input);
    expect(provider.calls).toBe(3);
    provider.resolvePending();
    await expect(fourth).resolves.toEqual(
      expect.objectContaining({ status: 'completed' }),
    );
  });
});
