import { BadRequestException, Injectable } from '@nestjs/common';
import type { ProductRecommendationCard } from '../recommendation/product-recommendation-card.types';
import type { AiArmanProductCardBlock } from './chat-messages.types';

@Injectable()
export class ProductCardBlockMapper {
  compose(cards: ProductRecommendationCard[]): AiArmanProductCardBlock | null {
    if (!Array.isArray(cards)) {
      throw new BadRequestException('verified_product_cards_required');
    }

    if (cards.length === 0) return null;

    const mapped = cards.slice(0, 3).map((card) => {
      this.assertVerifiedCard(card);

      return {
        productId: card.productId,
        title: card.title,
        imageUrl: card.imageUrl,
        productUrl: card.productUrl,
        price: card.price.amount,
        currency: 'SEK' as const,
        stockStatus: 'in_stock' as const,
        whyItFits: unique(card.whyItFits),
        inciSignals: unique(card.inciSignals),
        limitations: unique(card.limitations),
        usage: [],
        confidence: card.quality.confidence,
        factsFetchedAt: card.verification.fetchedAt,
      };
    });

    return {
      type: 'product_cards',
      cards: mapped,
    };
  }

  private assertVerifiedCard(card: ProductRecommendationCard): void {
    const fetchedAt = Date.parse(String(card?.verification?.fetchedAt || ''));
    const confidence = Number(card?.quality?.confidence);

    if (
      !card
      || card.schemaVersion !== 'ai-arman-product-card-v1'
      || card.type !== 'product_card'
      || !String(card.productId || '').trim()
      || !String(card.title || '').trim()
      || !String(card.productUrl || '').trim()
      || !Number.isFinite(card.price?.amount)
      || card.price.amount <= 0
      || String(card.price?.currency || '').trim().toUpperCase() !== 'SEK'
      || card.availability?.status !== 'in_stock'
      || card.verification?.productFactsSource !== 'vendre'
      || !Number.isFinite(fetchedAt)
      || !Number.isFinite(confidence)
      || confidence < 0
      || confidence > 100
    ) {
      throw new BadRequestException('verified_product_card_invalid');
    }
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(String).map((value) => value.trim()).filter(Boolean))];
}
