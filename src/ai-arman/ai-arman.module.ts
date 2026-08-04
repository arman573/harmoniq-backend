import { Module } from '@nestjs/common';
import { AiArmanController } from './ai-arman.controller';
import { AiArmanService } from './ai-arman.service';
import { ChatPreviewService } from './chat/chat-preview.service';
import { ProductDiscoveryService } from './discovery/product-discovery.service';
import { SearchBrainClient } from './integrations/search-brain.client';
import { RecommendationScoringService } from './recommendation/recommendation-scoring.service';

@Module({
  controllers: [AiArmanController],
  providers: [
    AiArmanService,
    ChatPreviewService,
    ProductDiscoveryService,
    SearchBrainClient,
    RecommendationScoringService,
  ],
  exports: [
    AiArmanService,
    ChatPreviewService,
    ProductDiscoveryService,
    SearchBrainClient,
    RecommendationScoringService,
  ],
})
export class AiArmanModule {}
