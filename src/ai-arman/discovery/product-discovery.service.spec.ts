import { ProductDiscoveryService } from './product-discovery.service';
import { SearchBrainClient } from '../integrations/search-brain.client';

describe('ProductDiscoveryService', () => {
  it('returns Search Brain products but blocks recommendation without verified INCI', async () => {
    const client = {
      autocomplete: jest.fn().mockResolvedValue({
        ok: true,
        configured: true,
        query: 'fukt schampo',
        durationMs: 42,
        upstreamStatus: 200,
        products: [
          {
            title: 'Fuktgivande schampo',
            brand: 'Test Brand',
            url: '/p/har/fuktgivande-schampo-12345.html',
            price: 299,
            score: 92,
          },
        ],
      }),
    } as unknown as SearchBrainClient;

    const service = new ProductDiscoveryService(client);
    const result = await service.discover('fukt schampo');

    expect(result.productsFound).toBe(1);
    expect(result.recommendationReady).toBe(0);
    expect(result.candidates[0].productId).toBe('12345');
    expect(result.candidates[0].scores.inciSuitability).toBe(0);
    expect(result.candidates[0].hardBlockers).toContain(
      'missing_verified_inci_evidence',
    );
    expect(result.safety.productionActionsEnabled).toBe(false);
  });

  it('fails closed when Search Brain is not configured', async () => {
    const client = {
      autocomplete: jest.fn().mockResolvedValue({
        ok: false,
        configured: false,
        query: 'schampo',
        durationMs: 0,
        products: [],
        error: 'search_brain_not_configured',
      }),
    } as unknown as SearchBrainClient;

    const service = new ProductDiscoveryService(client);
    const result = await service.discover('schampo');

    expect(result.ok).toBe(false);
    expect(result.productsFound).toBe(0);
    expect(result.source.error).toBe('search_brain_not_configured');
  });
});
