import { BadRequestException, Injectable } from '@nestjs/common';
import type { ProductRecommendationCard } from '../recommendation/product-recommendation-card.types';
import type { AiArmanProductCardBlock } from './chat-messages.types';

@Injectable()
export class ProductCardBlockMapper {
  compose(cards: ProductRecommendationCard[]): AiArmanProductCardBlock | null {
    if (!Array.isArray(cards