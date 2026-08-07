import type { AiArmanConversationState } from './chat-messages.types';
import {
  ChatInterpretationProvider,
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

const metadata: AiArmanInterpretationProviderMetadata = {
  provider: 'test-provider',
  modelVersion: 'test-model-v1',
  promptVersion: 'interpretation-prompt-v1',
};

class StaticConfig extends ChatInterpretationShadowConfig {
  constructor(
    private readonly enabled: boolean,
    private readonly timeoutMs?: number,
    private readonly maxCallsPerMinute?: number,
  ) {
    super();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  override providerTimeoutMs(): number {
    return this.timeoutMs ?? super.providerTimeoutMs();
  }

  override maxProviderCallsPerMinute(): number {
    return this.maxCallsPerMinute ?? super.maxProviderCallsPerMinute();
  }
}

class StubProvider extends ChatInterpretationProvider {
  calls = 0;

  constructor(
    private readonly result: AiArmanInterpretationProviderResult,
    private readonly shouldThrow = false,
    private readonly providerMetadata = metadata,
  ) {
    super();
  }

  metadata(): AiArmanInterpretationProviderMetadata {
    return this.providerMetadata;
  }

  async interpret(): Promise<AiArmanInterpretationProviderResult> {
    this.calls += 1;
    if (this.shouldThrow) throw new Error('provider failed');
    return this.result;
  }
}

class NeverProvider extends ChatInterpretationProvider {
  calls = 0;

  metadata(): AiArmanInterpretationProviderMetadata {
    return metadata;
  }

  async interpret(): Promise<AiArmanInterpretationProviderResult> {
    this.calls += 1;
    return new Promise(() => undefined);
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

function providerResult(
  usage: AiArmanInterpretationProviderResult['usage'] = {
    inputTokens: 120,
    outputTokens: 40,
    estimatedCostUsd: 0.0012,
  },
): AiArmanInterpretationProviderResult {
  return {
    candidate: candidate(),
    usage,
  };
}

function shadowService() {
  return new ChatInterpretationShadowService(new ChatInterpretationValidator());
}

describe('ChatInterpretationShadowOrchestrator', () => {
  it('does not call the provider while shadow mode is disabled', async () => {
    const provider = new StubProvider(providerResult());
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

  it('returns only comparison metrics plus normalized usage for a valid candidate', async () => {
    const provider = new StubProvider(providerResult());
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
    expect(result).toEqual(
      expect.objectContaining({
        usage: {
          inputTokens: 120,
          outputTokens: 40,
          totalTokens: 160,
          estimatedCostUsd: 0.0012,
        },
      }),
    );
    expect(provider.calls).toBe(1);
  });

  it('records only safe provider metadata and aggregate shadow metrics', async () => {
    const provider = new StubProvider(providerResult());
    const audit = new InMemoryChatInterpretationShadowAuditStore();
    const orchestrator = new ChatInterpretationShadowOrchestrator(
      new StaticConfig(true),
      shadowService(),
      provider,
      audit,
    );

    await orchestrator.run(deterministic, input);

    const records = audit.snapshot();
    expect(records).toHaveLength(1);
    expect(records[0]).toEqual(
      expect.objectContaining({
        provider: 'test-provider',
        modelVersion: 'test-model-v1',
        promptVersion: 'interpretation-prompt-v1',
        status: 'completed',
        inputTokens: 120,
        outputTokens: 40,
        totalTokens: 160,
        estimatedCostUsd: 0.0012,
        candidateValid: true,
        primaryIntentMatch: true,
      }),
    );
    expect(Object.keys(records[0])).not.toEqual(
      expect.arrayContaining([
        'text',
        'candidate',
        'conversationId',
        'previousState',
      ]),
    );
  });

  it('contains provider errors without exposing them to the caller', async () => {
    const provider = new StubProvider(providerResult(), true);
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

  it('contains unexpected shadow comparison failures as provider errors', async () => {
    const provider = new StubProvider(providerResult());
    const explodingShadow = {
      compare: jest.fn(() => {
        throw new Error('shadow comparison exploded');
      }),
    } as unknown as ChatInterpretationShadowService;
    const orchestrator = new ChatInterpretationShadowOrchestrator(
      new StaticConfig(true),
      explodingShadow,
      provider,
    );

    await expect(orchestrator.run(deterministic, input)).resolves.toEqual({
      status: 'provider_error',
      comparison: null,
    });
    expect(provider.calls).toBe(1);
  });

  it('fails closed when provider metadata is invalid', async () => {
    const provider = new StubProvider(providerResult(), false, {
      provider: '   ',
      modelVersion: 'test-model-v1',
      promptVersion: 'interpretation-prompt-v1',
    });
    const orchestrator = new ChatInterpretationShadowOrchestrator(
      new StaticConfig(true),
      shadowService(),
      provider,
    );

    await expect(orchestrator.run(deterministic, input)).resolves.toEqual({
      status: 'provider_error',
      comparison: null,
    });
    expect(provider.calls).toBe(0);
  });

  it('fails closed when provider usage metadata is invalid', async () => {
    const provider = new StubProvider(
      providerResult({ inputTokens: -1, outputTokens: 10 }),
    );
    const orchestrator = new ChatInterpretationShadowOrchestrator(
      new StaticConfig(true),
      shadowService(),
      provider,
    );

    await expect(orchestrator.run(deterministic, input)).resolves.toEqual({
      status: 'provider_error',
      comparison: null,
    });
    expect(provider.calls).toBe(1);
  });

  it('bounds provider latency and reports timeout without affecting authority', async () => {
    const provider = new NeverProvider();
    const orchestrator = new ChatInterpretationShadowOrchestrator(
      new StaticConfig(true, 5),
      shadowService(),
      provider,
    );

    await expect(orchestrator.run(deterministic, input)).resolves.toEqual({
      status: 'provider_timeout',
      comparison: null,
    });
    expect(provider.calls).toBe(1);
  });

  it('enforces the provider request budget before another model call', async () => {
    const provider = new StubProvider(providerResult());
    const orchestrator = new ChatInterpretationShadowOrchestrator(
      new StaticConfig(true, undefined, 1),
      shadowService(),
      provider,
    );

    await expect(orchestrator.run(deterministic, input)).resolves.toEqual(
      expect.objectContaining({ status: 'completed' }),
    );
    await expect(orchestrator.run(deterministic, input)).resolves.toEqual({
      status: 'provider_rate_limited',
      comparison: null,
    });
    expect(provider.calls).toBe(1);
  });
});
