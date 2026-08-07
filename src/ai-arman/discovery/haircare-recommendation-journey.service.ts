import { BadRequestException, Injectable } from '@nestjs/common';
import type { AiArmanInterpretation } from '../chat/chat-messages.types';
import type { ProductIntelligenceRequestProduct } from '../integrations/product-intelligence.types';
import { ProductDiscoveryService } from './product-discovery.service';
import { ProductIntelligenceEnrichmentService } from './product-intelligence-enrichment.service';

const MAX_DISCOVERY_PRODUCTS = 25;

@Injectable()
export class HaircareRecommendationJourneyService {
  constructor(
    private readonly discovery: ProductDiscoveryService,
    private readonly enrichment: ProductIntelligenceEnrichmentService,
  ) {}

  async prepare(interpretation: AiArmanInterpretation) {
    if (interpretation.primaryIntent !== 'product_recommendation') {
      throw new BadRequestException('recommendation_intent_required');
    }

    const query = buildDiscoveryQuery(interpretation);
    const discovered = await this.discovery.discover(query);
    const products = discovered.candidates
      .slice(0, MAX_DISCOVERY_PRODUCTS)
      .map((candidate) => toIntelligenceProduct(candidate));

    if (!discovered.ok || products.length === 0) {
      return {
        status: 'no_verified_candidates' as const,
        query,
        productsFound: discovered.productsFound,
        recommendations: [],
        rejected: [],
        safety: safetyState(),
      };
    }

    const enriched = await this.enrichment.enrich({
      message: query,
      products,
    });

    return {
      status:
        enriched.recommendations.length > 0
          ? ('ready_for_live_facts' as const)
          : ('no_verified_candidates' as const),
      query,
      productsFound: discovered.productsFound,
      recommendations: enriched.recommendations,
      rejected: enriched.rejected,
      safety: safetyState(),
    };
  }
}

function toIntelligenceProduct(candidate: {
  productId: string;
  title: string;
  discovery?: Record<string, unknown>;
}): ProductIntelligenceRequestProduct {
  const url = String(candidate.discovery?.url || '').trim();
  return {
    productId: candidate.productId,
    title: candidate.title,
    ...(url ? { url } : {}),
  };
}

function buildDiscoveryQuery(interpretation: AiArmanInterpretation): string {
  const labels: Record<string, string> = {
    shampoo: 'schampo',
    conditioner: 'balsam',
    hair_mask: 'hårinpackning',
    leave_in: 'leave-in',
    thin_hair: 'tunt hår',
    color_treated_hair: 'färgat hår',
    oily_scalp: 'fet hårbotten',
    dry_lengths: 'torra längder',
    frizz_control: 'friss',
    sensitive_scalp: 'känslig hårbotten',
    fragrance: 'utan parfym',
    silicones: 'utan silikon',
    proteins: 'utan protein',
  };

  const values = [
    ...interpretation.entities.requestedProductTypes,
    ...interpretation.entities.needs,
    ...interpretation.entities.exclusions,
  ];

  const query = values
    .map((value) => labels[value])
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .trim();

  if (query.length < 2) {
    throw new BadRequestException('recommendation_discovery_query_missing');
  }
  return query.slice(0, 200);
}

function safetyState() {
  return {
    readOnly: true,
    backendOwnedCandidates: true,
    productIntelligenceRequired: true,
    liveProductFactsVerified: false,
    customerProductCardsReady: false,
    productionActionsEnabled: false,
  } as const;
}
