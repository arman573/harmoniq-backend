import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AiArmanService } from './ai-arman.service';
import { ChatPreviewService } from './chat/chat-preview.service';
import type { ChatPreviewRequest } from './chat/chat-preview.types';
import { ProductDiscoveryService } from './discovery/product-discovery.service';
import { ProductIntelligenceEnrichmentService } from './discovery/product-intelligence-enrichment.service';
import type { ProductIntelligencePreviewRequest } from './discovery/product-intelligence-enrichment.service';
import type { RecommendationCandidate } from './recommendation/recommendation.types';

@Controller('ai-arman')
export class AiArmanController {
  constructor(
    private readonly aiArmanService: AiArmanService,
    private readonly chatPreviewService: ChatPreviewService,
    private readonly productDiscoveryService: ProductDiscoveryService,
    private readonly productIntelligenceEnrichmentService: ProductIntelligenceEnrichmentService,
  ) {}

  @Get('foundation')
  getFoundationStatus() {
    return this.aiArmanService.getFoundationStatus();
  }

  @Get('products/discover')
  discoverProducts(@Query('q') query: string) {
    return this.productDiscoveryService.discover(query);
  }

  @Post('products/intelligence/preview')
  previewProductIntelligence(@Body() body: ProductIntelligencePreviewRequest) {
    return this.productIntelligenceEnrichmentService.enrich(body);
  }

  @Post('recommendations/preview')
  previewRecommendations(
    @Body() body: { candidates?: RecommendationCandidate[] },
  ) {
    return this.aiArmanService.previewRecommendations(body?.candidates ?? []);
  }

  @Post('chat/preview')
  previewChat(@Body() body: ChatPreviewRequest) {
    return this.chatPreviewService.compose(body);
  }
}
