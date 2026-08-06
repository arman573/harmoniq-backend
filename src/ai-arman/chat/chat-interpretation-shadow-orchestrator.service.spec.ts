import type { AiArmanConversationState } from './chat-messages.types';
import { ChatInterpretationProvider } from './chat-interpretation.provider';
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
  confidence: 0.72,
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
  text: 'Jag söker schampo för torrt hår',
  locale: 'sv-SE' as const,
  previousState: null as AiArmanConversationState | null,
};

class StaticConfig extends ChatInterpretationShadowConfig {
  constructor(private readonly enabled: boolean) {
    super();
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

class StubProvider extends ChatInterpretationProvider {
  calls = 0;

  constructor(private readonly result: unknown, private readonly shouldThrow = false) {
    super();
  }

  async interpret(): Promise<unknown> {
    this.calls += 1;
    if (this.shouldThrow) throw new Error('provider failed');
    return this.result;
  }
}

function candidate() {
  return {
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
  };
}

function shadowService() {
  return new ChatInterpretationShadowService(new ChatInterpretationValidator());
}

describe('ChatInterpretationShadowOrchestrator', () => {
  it('does not call the provider while shadow mode is disabled', async () => {
    const provider = new StubProvider(candidate());
    const orchestrator = new ChatInterpretationShadowOrchestrator(
      new StaticConfig(false),
      shadowService(),
      provider,
    );

    await expect(orchestrator.run(deterministic, input)).resolves.toEqual({
      status: 'disabled',
      comparison: null,
    });
    expect(provider.calls).toBe(0);
  });

  it('fails closed when enabled without a configured provider', async () => {
    const orchestrator = new ChatInterpretationShadowOrchestrator(
      new StaticConfig(true),
      shadowService(),
    );

    await expect(orchestrator.run(deterministic, input)).resolves.toEqual({
      status: 'provider_not_configured',
      comparison: null,
    });
  });

  it('returns only comparison metrics for a valid candidate', async () => {
    const provider = new StubProvider(candidate());
    const orchestrator = new ChatInterpretationShadowOrchestrator(
      new StaticConfig(true),
      shadowService(),
      provider,
    );

    const result = await orchestrator.run(deterministic, input);

    expect(result.status).toBe('completed');
    expect(result.comparison).toEqual(
      expect.objectContaining({
        status: 'valid_candidate',
        primaryIntentMatch: true,
        affectsCustomerResponse: false,
        affectsState: false,
        affectsTools: false,
      }),
    );
    expect(provider.calls).toBe(1);
  });

  it('contains provider errors without exposing them to the caller', async () => {
    const provider = new StubProvider(null, true);
    const orchestrator = new ChatInterpretationShadowOrchestrator(
      new StaticConfig(true),
      shadowService(),
      provider,
    );

    await expect(orchestrator.run(deterministic, input)).resolves.toEqual({
      status: 'provider_error',
      comparison: null,
    });
  });
});
