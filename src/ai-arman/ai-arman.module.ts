import { Module } from '@nestjs/common';
import { AiArmanController } from './ai-arman.controller';
import { AiArmanService } from './ai-arman.service';
import { ChatConversationStateStore } from './chat/chat-conversation-state.store';
import { ChatConversationService } from './chat/chat-conversation.service';
import { ChatMessagesService } from './chat/chat-messages.service';
import { ChatPreviewService } from './chat/chat-preview.service';
import { ProductDiscoveryService } from './discovery/product-discovery.service';
import { ProductIntelligenceEnrichmentService } from './discovery/product-intelligence-enrichment.service';
import { ProductIntelligenceClient } from './integrations/product-intelligence.client';
import { SearchBrainClient } from './integrations/search-brain.client';
import { RecommendationScoringService } from './recommendation/recommendation-scoring.service';

@Module({
  controllers: [AiArmanController],
  providers: [
    AiArmanService,
    ChatConversationStateStore,
    ChatConversationService,
    ChatMessagesService,
    ChatPreviewService,
    ProductDiscoveryService,
    ProductIntelligenceEnrichmentService,
    ProductIntelligenceClient,
    SearchBrainClient,
    RecommendationScoringService,
  ],
  exports: [
    AiArmanService,
    ChatConversationStateStore,
    ChatConversationService,
    ChatMessagesService,
    ChatPreviewService,
    ProductDiscoveryService,
    ProductIntelligenceEnrichmentService,
    ProductIntelligenceClient,
    SearchBrainClient,
    RecommendationScoringService,
  ],
})
export class AiArmanModule {}
