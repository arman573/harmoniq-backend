import { BadRequestException, Injectable } from '@nestjs/common';
import { getProductLiveFactsFreshnessRejectionReason } from '../integrations/product-live-facts-freshness.policy';
import type { ProductLiveFact } from '../integrations/product-live-facts.types';
import type { ScoredRecommendationCandidate } from './recommendation.types';
import {
  PRODUCT_RECOMMENDATION_CARD_SCHEMA_VERSION,
  ProductRecommendationCard,
} from './product-recommendation-card.types';

type VerifiedRecommendation = ScoredRecommendationCandidate & {
  liveFacts: ProductLiveFact;
};

@Injectable()
export class ProductRecommendationCardService {
  compose(candidates: VerifiedRecommendation[]): ProductRecommendationCard[] {
    if (!Array.isArray(candidates)) {
      throw new BadRequestException('verified_recommendations_required');
    }

    return candidates.slice(0, 3).map((candidate, index) =>
      this.toCard(candidate, index),
    );
  }

  private toCard(
    candidate: VerifiedRecommendation,
    index: number,
  ): ProductRecommendationCard {
    this.assertVerifiedCandidate(candidate);

    return {
      schemaVersion: PRODUCT_RECOMMENDATION_CARD_SCHEMA_VERSION,
      type: 'product_card',
      position: index + 1,
      label: index === 0 ? 'Bäst matchning' : 'Godkänt alternativ',
      productId: candidate.productId,
      title: candidate.title,
      imageUrl: candidate.liveFacts.imageUrl,
      productUrl: candidate.liveFacts.canonicalUrl,
      price: {
        amount: candidate.liveFacts.price.amount,
        currency: candidate.liveFacts.price.currency,
      },
      availability: {
        status: 'in_stock',
        quantity: candidate.liveFacts.stock.quantity,
      },
      whyItFits: unique([
        ...candidate.evidence.designationReasons,
        ...candidate.evidence.categoryReasons,
        ...candidate.evidence.tagReasons,
      ]),
      inciSignals: unique(candidate.evidence.inciSignals),
      limitations: unique(candidate.evidence.limitations),
      quality: {
        score: candidate.qualityScore,
        rankingScore: candidate.rankingScore,
        tier: candidate.tier as 'A' | 'B' | 'C',
        confidence: clamp(candidate.evidence.confidence),
      },
      verification: {
        productFactsSource: 'vendre',
        fetchedAt: candidate.liveFacts.fetchedAt,
      },
    };
  }

  private assertVerifiedCandidate(candidate: VerifiedRecommendation): void {
    if (!candidate?.eligible || candidate.tier === 'REJECTED') {
      throw new BadRequestException('eligible_recommendation_required');
    }

    const facts = candidate.liveFacts;
    const freshnessRejection = getProductLiveFactsFreshnessRejectionReason(
      facts?.fetchedAt,
    );
    if (
      !facts
      || String(facts.productId || '').trim() !== candidate.productId
      || facts.active !== true
      || facts.visible !== true
      || facts.stock?.availability !== 'in_stock'
      || facts.source !== 'vendre'
      || !String(facts.canonicalUrl || '').trim()
      || !Number.isFinite(facts.price?.amount)
      || facts.price.amount <= 0
      || !String(facts.price?.currency || '').trim()
      || freshnessRejection !== null
    ) {
      throw new BadRequestException('verified_product_live_facts_required');
    }
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(String).map((value) => value.trim()).filter(Boolean))];
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}
