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

class BudgetConfig extends ChatInterpretationShadowConfig {
  constructor(
    private readonly perCallTokens: number,
    private readonly perMinuteTokens: number,
    private readonly perCallCostUsd = 1,
    private readonly perMinuteCostUsd = 10,
  ) {
    super();
  }

  isEnabled(): boolean {
    return true;
  }

  override maxProviderTokensPerCall(): number {
    return this.perCallTokens;
  }

  override maxProviderTokensPerMinute(): number {
    return this.perMinuteTokens;
  }

  override maxEstimatedCostUsdPerCall(): number {
    return this.perCallCostUsd;
  }

  override maxEstimatedCostUsdPerMinute(): number {
    return this.perMinuteCostUsd;
  }
}

class UsageProvider extends ChatInterpretationProvider {
  calls = 0;

  constructor(private readonly usage: AiArmanInterpretationProviderResult['usage']) {
    super();
  }

  metadata(): AiArmanInterpretationProviderMetadata {
    return {
      provider: 'budget-test',
      modelVersion: 'model-v1',
      promptVersion: 'prompt-v1',
    };
  }

  async interpret(): Promise<AiArmanInterpretationProviderResult> {
    this.calls += 1;
    return {
      candidate: {
        schemaVersion: 'ai-arman-interpretation-v1',
        source: 'model_candidate',
        locale: 'sv-SE',
        primaryIntent: 'product_recommendation',
        secondaryIntents: [],
        confidence: 0.8,
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
      },
      usage: this.usage,
    };
  }
}

function shadowService() {
  return new ChatInterpretationShadowService(new ChatInterpretationValidator());
}

describe('ChatInterpretationShadowOrchestrator budgets', () => {
  it('rejects candidate authority when one provider call exceeds the token budget', async () => {
    const provider = new UsageProvider({ inputTokens: 90, outputTokens: 20 });
    const orchestrator = new ChatInterpretationShadowOrchestrator(
      new BudgetConfig(100, 1000),
      shadowService(),
      provider,
    );

    await expect(orchestrator.run(deterministic, input)).resolves.toEqual({
      status: 'provider_budget_exceeded',
      comparison: null,
      usage: {
        inputTokens: 90,
        outputTokens: 20,
        totalTokens: 110,
        estimatedCostUsd: null,
      },
    });
    expect(provider.calls).toBe(1);
  });

  it('rejects candidate authority when one provider call exceeds the estimated cost budget', async () => {
    const provider = new UsageProvider({
      inputTokens: 100,
      outputTokens: 50,
      estimatedCostUsd: 0.021,
    });
    const orchestrator = new ChatInterpretationShadowOrchestrator(
      new BudgetConfig(1000, 10_000, 0.02, 0.1),
      shadowService(),
      provider,
    );

    await expect(orchestrator.run(deterministic, input)).resolves.toEqual({
      status: 'provider_budget_exceeded',
      comparison: null,
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        estimatedCostUsd: 0.021,
      },
    });
    expect(provider.calls).toBe(1);
  });

  it('blocks the next provider call after the rolling minute token budget is exhausted', async () => {
    const provider = new UsageProvider({ inputTokens: 60, outputTokens: 40 });
    const orchestrator = new ChatInterpretationShadowOrchestrator(
      new BudgetConfig(200, 100),
      shadowService(),
      provider,
    );

    await expect(orchestrator.run(deterministic, input)).resolves.toEqual(
      expect.objectContaining({ status: 'completed' }),
    );
    await expect(orchestrator.run(deterministic, input)).resolves.toEqual({
      status: 'provider_budget_exceeded',
      comparison: null,
      usage: null,
    });
    expect(provider.calls).toBe(1);
  });
});
