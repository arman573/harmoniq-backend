import { BadRequestException, Injectable } from '@nestjs/common';
import type { AiArmanInterpretation } from '../chat/chat-messages.types';
import { ProductLiveFactsClient } from '../integrations/product-live-facts.client';
import type {
  ProductLiveFact,
  ProductLiveFactsRequestProduct,
} from '../integrations/product-live-facts.types';
import type { ProductIntelligenceRequestProduct } from '../integrations/product-intelligence.types';
import { ProductRecommendationCardService } from '../recommendation/product-recommendation-card.service';
import type { ScoredRecommendationCandidate } from '../recommendation/recommendation.types';
import { ProductDiscoveryService } from './product-discovery.service';
import { ProductIntelligenceEnrichmentService } from './product-intelligence-enrichment.service';

const MAX_DISCOVERY_PRODUCTS = 25;
const MAX_LIVE_FACTS_AGE_MS = 5 * 60 * 1000;
const MAX_LIVE_FACTS_FUTURE_SKEW_MS = 60 * 1000;

@Injectable()
export class HaircareRecommendationJourneyService {
  constructor(
    private readonly discovery: ProductDiscoveryService,
    private readonly enrichment: ProductIntelligenceEnrichmentService,
    private readonly productLiveFacts: ProductLiveFactsClient,
    private readonly productCards: ProductRecommendationCardService,
  ) {}

  async prepare(interpretation: AiArmanInterpretation) {
    if (interpretation.primaryIntent !== 'product_recommendation') {
      throw new BadRequestException('recommendation_intent_required');
    }

    const query = buildDiscoveryQuery(interpretation);
    const discovered = await this.discovery.discover(query);
    const discoveryCandidates = discovered.candidates.slice(
      0,
      MAX_DISCOVERY_PRODUCTS,
    );
    const products = discoveryCandidates.map((candidate) =>
      toIntelligenceProduct(candidate),
    );
    const liveFactsMetadata = new Map(
      discoveryCandidates
        .map((candidate) => toLiveFactsRequestProduct(candidate))
        .filter(
          (product): product is ProductLiveFactsRequestProduct =>
            product !== null,
        )
        .map((product) => [product.productId, product] as const),
    );

    if (!discovered.ok || products.length === 0) {
      return {
        status: 'no_verified_candidates' as const,
        query,
        productsFound: discovered.productsFound,
        recommendations: [],
        productCards: [],
        rejected: [],
        liveFacts: null,
        liveFactsRejected: [],
        safety: safetyState(false, false),
      };
    }

    const enriched = await this.enrichment.enrich({
      message: query,
      products,
    });

    if (enriched.recommendations.length === 0) {
      return {
        status: 'no_verified_candidates' as const,
        query,
        productsFound: discovered.productsFound,
        recommendations: [],
        productCards: [],
        rejected: enriched.rejected,
        liveFacts: null,
        liveFactsRejected: [],
        safety: safetyState(false, false),
      };
    }

    const liveFactsRequestProducts = enriched.recommendations
      .map((candidate) => liveFactsMetadata.get(candidate.productId) ?? null)
      .filter(
        (product): product is ProductLiveFactsRequestProduct => product !== null,
      );

    const liveFactsLookup = await this.productLiveFacts.getFacts(
      liveFactsRequestProducts,
    );

    if (!liveFactsLookup.ok) {
      return {
        status: 'live_facts_unavailable' as const,
        query,
        productsFound: discovered.productsFound,
        recommendations: [],
        productCards: [],
        candidatesAwaitingLiveFacts: enriched.recommendations,
        rejected: enriched.rejected,
        liveFacts: {
          configured: liveFactsLookup.configured,
          source: liveFactsLookup.source,
          requestedProductIds: liveFactsLookup.requestedProductIds,
          missingProductIds: liveFactsLookup.missingProductIds,
          error: liveFactsLookup.error,
        },
        liveFactsRejected: [],
        safety: safetyState(false, false),
      };
    }

    const verified = verifyRecommendationsAgainstLiveFacts(
      enriched.recommendations,
      liveFactsLookup.facts,
    );
    const productCards = this.productCards.compose(verified.recommendations);
    const cardsReady = productCards.length > 0;

    return {
      status: cardsReady
        ? ('product_cards_ready' as const)
        : ('no_verified_live_products' as const),
      query,
      productsFound: discovered.productsFound,
      recommendations: verified.recommendations,
      productCards,
      rejected: enriched.rejected,
      liveFacts: {
        configured: liveFactsLookup.configured,
        source: liveFactsLookup.source,
        requestedProductIds: liveFactsLookup.requestedProductIds,
        missingProductIds: liveFactsLookup.missingProductIds,
        error: liveFactsLookup.error,
      },
      liveFactsRejected: verified.rejected,
      safety: safetyState(cardsReady, cardsReady),
    };
  }
}

function verifyRecommendationsAgainstLiveFacts(
  candidates: ScoredRecommendationCandidate[],
  facts: ProductLiveFact[],
) {
  const factsByProductId = new Map(
    facts.map((fact) => [String(fact?.productId || '').trim(), fact]),
  );
  const recommendations: Array<
    ScoredRecommendationCandidate & { liveFacts: ProductLiveFact }
  > = [];
  const rejected: Array<{ productId: string; reasons: string[] }> = [];

  for (const candidate of candidates) {
    const fact = factsByProductId.get(candidate.productId);
    const reasons = validateLiveFact(candidate, fact);

    if (!fact || reasons.length > 0) {
      rejected.push({ productId: candidate.productId, reasons });
      continue;
    }

    recommendations.push({ ...candidate, liveFacts: fact });
  }

  return { recommendations, rejected };
}

function validateLiveFact(
  candidate: ScoredRecommendationCandidate,
  fact: ProductLiveFact | undefined,
): string[] {
  if (!fact) return ['missing_product_live_facts'];

  const reasons: string[] = [];
  const productId = String(fact.productId || '').trim();
  const canonicalUrl = String(fact.canonicalUrl || '').trim();
  const title = String(fact.title || '').trim();
  const currency = String(fact.price?.currency || '').trim().toUpperCase();
  const amount = Number(fact.price?.amount);
  const quantity = fact.stock?.quantity;
  const fetchedAt = Date.parse(String(fact.fetchedAt || ''));
  const now = Date.now();

  if (productId !== candidate.productId) reasons.push('product_identity_mismatch');
  if (normalizeIdentity(title) !== normalizeIdentity(candidate.title)) {
    reasons.push('product_title_mismatch');
  }
  if (!canonicalUrl) reasons.push('missing_canonical_product_url');
  if (!Number.isFinite(amount) || amount <= 0) reasons.push('invalid_verified_price');
  if (!/^[A-Z]{3}$/.test(currency)) reasons.push('invalid_price_currency');
  if (fact.active !== true) reasons.push('product_inactive');
  if (fact.visible !== true) reasons.push('product_hidden');
  if (fact.stock?.availability !== 'in_stock') reasons.push('product_not_in_stock');
  if (quantity !== null && (!Number.isFinite(quantity) || Number(quantity) <= 0)) {
    reasons.push('invalid_stock_quantity');
  }
  if (!Number.isFinite(fetchedAt)) {
    reasons.push('invalid_live_facts_timestamp');
  } else {
    if (now - fetchedAt > MAX_LIVE_FACTS_AGE_MS) {
      reasons.push('stale_live_facts');
    }
    if (fetchedAt - now > MAX_LIVE_FACTS_FUTURE_SKEW_MS) {
      reasons.push('future_live_facts_timestamp');
    }
  }
  if (fact.source !== 'vendre') reasons.push('invalid_live_facts_source');

  return [...new Set(reasons)];
}

function normalizeIdentity(value: string): string {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('sv-SE')
    .replace(/\s+/g, ' ');
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

function toLiveFactsRequestProduct(candidate: {
  productId: string;
  title: string;
  discovery?: Record<string, unknown>;
}): ProductLiveFactsRequestProduct | null {
  const productId = String(candidate.productId || '').trim();
  const title = String(candidate.title || '').trim();
  const canonicalUrl = String(candidate.discovery?.url || '').trim();
  const imageUrl = String(candidate.discovery?.imageUrl || '').trim() || null;

  if (!productId || !title || !canonicalUrl) return null;

  return {
    productId,
    title,
    canonicalUrl,
    imageUrl,
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

function safetyState(
  liveProductFactsVerified: boolean,
  customerProductCardsReady: boolean,
) {
  return {
    readOnly: true,
    backendOwnedCandidates: true,
    productIntelligenceRequired: true,
    liveProductFactsVerified,
    customerProductCardsReady,
    productionActionsEnabled: false,
  } as const;
}
