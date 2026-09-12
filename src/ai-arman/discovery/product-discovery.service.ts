import { BadRequestException, Injectable } from '@nestjs/common';
import { SearchBrainClient } from '../integrations/search-brain.client';
import { RecommendationCandidate } from '../recommendation/recommendation.types';

@Injectable()
export class ProductDiscoveryService {
  constructor(private readonly searchBrainClient: SearchBrainClient) {}

  async discover(query: string) {
    const normalizedQuery = String(query || '').trim();

    if (normalizedQuery.length < 2 || normalizedQuery.length > 200) {
      throw new BadRequestException(
        'Discovery query must contain between 2 and 200 characters.',
      );
    }

    const result = await this.searchBrainClient.autocomplete(normalizedQuery);
    const candidates = result.products.map((product, index) =>
      this.toBlockedCandidate(product, index),
    );

    return {
      ok: result.ok,
      mode: 'read-only-discovery',
      query: normalizedQuery,
      source: {
        service: 'search-brain',
        configured: result.configured,
        durationMs: result.durationMs,
        upstreamStatus: result.upstreamStatus,
        error: result.error,
      },
      navigationTarget: result.navigationTarget,
      productsFound: result.products.length,
      recommendationReady: 0,
      candidates,
      safety: {
        liveSearchUsed: result.ok,
        liveProductFactsVerified: false,
        inciEvidenceVerified: false,
        productionActionsEnabled: false,
        rule:
          'Search discovery alone can never make a product recommendation. Verified designation and INCI evidence are required.',
      },
    };
  }

  private toBlockedCandidate(
    product: {
      title?: string;
      brand?: string;
      url?: string;
      imageUrl?: string;
      price?: unknown;
      score?: number;
    },
    index: number,
  ): RecommendationCandidate & {
    discovery: Record<string, unknown>;
  } {
    const searchScore = this.clamp(Number(product.score ?? 0));
    const productId = this.deriveProductId(product.url, index);

    return {
      productId,
      title: String(product.title || 'Okänd produkt'),
      scores: {
        designation: searchScore,
        inciSuitability: 0,
        category: 0,
        tags: 0,
      },
      hardBlockers: ['missing_verified_inci_evidence'],
      personalizationScore: 0,
      evidence: {
        designationReasons: [
          'Search Brain returned the product as a search candidate.',
        ],
        inciSignals: [],
        categoryReasons: [],
        tagReasons: [],
        limitations: [
          'No verified INCI analysis is attached.',
          'Price and stock have not been verified against Vendre.',
        ],
        confidence: 0,
        engineVersion: 'search-discovery-adapter-v1',
      },
      discovery: {
        brand: product.brand,
        url: product.url,
        imageUrl: product.imageUrl,
        upstreamPrice: product.price,
        upstreamSearchScore: searchScore,
      },
    };
  }

  private deriveProductId(url: string | undefined, index: number): string {
    const normalized = String(url || '').trim();
    if (!normalized) return `search-candidate-${index + 1}`;

    const match = normalized.match(/(?:-|\/)(\d+)(?:\.html)?(?:[?#]|$)/);
    return match?.[1] || `url:${normalized}`;
  }

  private clamp(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.min(100, Math.max(0, value));
  }
}
