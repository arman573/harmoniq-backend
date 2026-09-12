import { InMemoryChatInterpretationShadowAuditStore } from './chat-interpretation-shadow-audit.store';

function record(index: number) {
  return {
    recordedAt: new Date(index).toISOString(),
    provider: 'test-provider',
    modelVersion: 'test-model-v1',
    promptVersion: 'prompt-v1',
    status: 'completed' as const,
    latencyMs: 10,
    inputTokens: index,
    outputTokens: 1,
    totalTokens: index + 1,
    estimatedCostUsd: 0.001,
    candidateValid: true,
    primaryIntentMatch: true,
  };
}

describe('InMemoryChatInterpretationShadowAuditStore', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps only the newest 500 records', () => {
    const store = new InMemoryChatInterpretationShadowAuditStore();

    for (let index = 0; index < 501; index += 1) {
      store.record(record(index));
    }

    const snapshot = store.snapshot();
    expect(snapshot).toHaveLength(500);
    expect(snapshot[0].inputTokens).toBe(1);
    expect(snapshot[499].inputTokens).toBe(500);
  });

  it('expires records after 24 hours', () => {
    const now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    const store = new InMemoryChatInterpretationShadowAuditStore();
    store.record(record(1));

    jest.spyOn(Date, 'now').mockReturnValue(now + 24 * 60 * 60 * 1000 + 1);
    expect(store.snapshot()).toEqual([]);
  });

  it('returns cloned records instead of mutable internal references', () => {
    const store = new InMemoryChatInterpretationShadowAuditStore();
    store.record(record(1));

    const first = store.snapshot();
    first[0].provider = 'mutated';

    expect(store.snapshot()[0].provider).toBe('test-provider');
  });
});
