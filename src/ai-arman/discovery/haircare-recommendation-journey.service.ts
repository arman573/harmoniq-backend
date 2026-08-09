import { BadRequestException, Injectable } from '@nestjs/common';
import type { AiArmanInterpretation } from '../chat/chat-messages.types';
import { ProductLiveFactsClient } from '../integrations/product-live-facts.client';
import type {
  ProductLiveFact,
  ProductLiveFactsRequestProduct,
} from '../integrations/product-live-facts.types';
import type { ProductIntelligenceRequestProduct } from '../integrations/product-intelligence.types';
import { ProductRecommendationCardService } from '../recommendation/product