import { AiArmanAdminLearningStore, detectLearningScenario } from './admin-learning.store';

describe('AI Arman scenario-relevant approved learning retrieval', () => {
  const originalFetch = global.fetch;
  const originalBucket = process.env.AI_ARMAN_LEARNING_GCS_BUCKET;
  const originalObject = process.env.AI_ARMAN_LEARNING_GCS_OBJECT;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalBucket === undefined) delete process.env.AI_ARMAN_LEARNING_GCS_BUCKET;
    else process.env.AI_ARMAN_LEARNING_GCS_BUCKET = originalBucket;
    if (originalObject === undefined) delete process.env.AI_ARMAN_LEARNING_GCS_OBJECT;
    else process.env.AI_ARMAN_LEARNING_GCS_OBJECT = originalObject;
  });

  it('detects stock shortage only from verified current stock facts', () => {
    expect(detectLearningScenario({
      products: [{ orderedQuantity: 3, stockVerified: true, stockQuantity: 1 }],
    })).toBe('stock_shortage');

    expect(detectLearningScenario({
      products: [{ orderedQuantity: 3, stockVerified: false, stockQuantity: 1 }],
    })).toBe('general');
  });

  it('keeps an older stock lesson ahead of newer generic lessons when current facts prove stock shortage', async () => {
    process.env.AI_ARMAN_LEARNING_GCS_BUCKET = 'test-learning-bucket';
    process.env.AI_ARMAN_LEARNING_GCS_OBJECT = `test-${Date.now()}-stock.json`;

    const lessons = [
      {
        id: 'stock-old',
        createdAt: '2026-08-01T00:00:00Z',
        createdBy: 'returns-admin-reviewed-reply',
        caseType: 'order_issue',
        scenario: 'stock_shortage',
        principle: 'När verifierat lager är lägre än beställt antal kan hela orderraden inte skickas ännu.',
        appliesWhen: 'stockVerified=true och stockQuantity är lägre än orderedQuantity.',
        avoid: 'Återanvänd aldrig gamla lagersiffror.',
        approvedReplyExample: 'Vi väntar in resterande antal.',
        internalRationale: 'PRIVAT: vi hade bara en kvar.',
      },
      ...Array.from({ length: 9 }, (_, index) => ({
        id: `generic-${index}`,
        createdAt: `2026-08-${String(10 + index).padStart(2, '0')}T00:00:00Z`,
        createdBy: 'returns-admin-reviewed-reply',
        caseType: 'support',
        scenario: 'general',
        principle: `Generiskt supportmönster ${index}`,
        appliesWhen: 'Liknande supportärende.',
        avoid: 'Använd bara verifierade fakta.',
      })),
    ];

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('metadata.google.internal')) {
        return new Response(JSON.stringify({ access_token: 'test-token', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('?alt=media')) {
        return new Response(JSON.stringify({ version: 'ai-arman-support-learning-v1', lessons }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ generation: '7' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const store = new AiArmanAdminLearningStore();
    const selected = await store.listRelevant('support', {
      messages: [{ direction: 'inbound', text: 'När skickas min order?' }],
      products: [{ orderedQuantity: 3, stockVerified: true, stockQuantity: 1, shortfallQuantity: 2 }],
    });

    expect(selected).toHaveLength(8);
    const stock = selected.find((lesson) => lesson.id === 'stock-old');
    expect(stock).toBeTruthy();
    expect(stock?.scenario).toBe('stock_shortage');
    expect(JSON.stringify(stock)).not.toContain('PRIVAT');
    expect(selected.filter((lesson) => lesson.id.startsWith('generic-'))).toHaveLength(7);
  });

  it('does not pull a cross-case stock lesson into a general case without verified stock shortage', async () => {
    process.env.AI_ARMAN_LEARNING_GCS_BUCKET = 'test-learning-bucket';
    process.env.AI_ARMAN_LEARNING_GCS_OBJECT = `test-${Date.now()}-general.json`;
    const lessons = [
      {
        id: 'stock-cross-case',
        createdAt: '2026-08-01T00:00:00Z',
        createdBy: 'returns-admin-reviewed-reply',
        caseType: 'order_issue',
        scenario: 'stock_shortage',
        principle: 'Verifierad lagerbrist.',
        appliesWhen: 'Verifierad lagerbrist.',
        avoid: 'Gamla fakta.',
      },
      {
        id: 'generic-support',
        createdAt: '2026-08-02T00:00:00Z',
        createdBy: 'returns-admin-reviewed-reply',
        caseType: 'support',
        scenario: 'general',
        principle: 'Generisk supportton.',
        appliesWhen: 'Support.',
        avoid: 'Gamla fakta.',
      },
    ];

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('metadata.google.internal')) {
        return new Response(JSON.stringify({ access_token: 'test-token', expires_in: 3600 }), { status: 200 });
      }
      if (url.includes('?alt=media')) {
        return new Response(JSON.stringify({ lessons }), { status: 200 });
      }
      return new Response(JSON.stringify({ generation: '8' }), { status: 200 });
    }) as typeof fetch;

    const store = new AiArmanAdminLearningStore();
    const selected = await store.listRelevant('support', { messages: [{ text: 'Tack!' }] });
    expect(selected.map((lesson) => lesson.id)).toEqual(['generic-support']);
  });
});
