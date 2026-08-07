import { Module } from '@nestjs/common';
import { AiArmanController } from './ai-arman.controller';
import { AiArmanService } from './ai-arman.service';
import {
  ChatConversationResultRepository,
  ChatConversationStateRepository,
} from './chat/chat-conversation.repositories';
import { ChatConversationResultStore } from './chat/chat-conversation-result.store';
import { ChatConversationStateStore } from './chat/chat-conversation-state.store';
import { ChatConversationService } from './chat/chat-conversation.service';
import {
  ChatInterpretationShadowAuditSink,
  InMemoryChatInterpretationShadowAuditStore,
} from './chat/chat-interpretation-shadow-audit.store';
import {
  ChatInterpretationShadowConfig,
  DisabledChatInterpretationShadowConfig,
} from './chat/chat-interpretation-shadow.config';
import { ChatInterpretationShadowOrchestrator } from './chat/chat-interpretation-shadow-orchestrator.service';
import { ChatInterpretationShadowService } from './chat/chat-interpretation-shadow.service';
import { ChatInterpretationValidator } from './chat/chat-interpretation.validator';
import { ChatMessagesService } from './chat/chat-messages.service';
import { ChatPreviewService } from './chat/chat-preview.service';
import { ChatRequestParser } from './chat/chat-request.parser';
import { HaircareRecommendationJourneyService } from './discovery/haircare-recommendation-journey.service';
import { ProductDiscoveryService } from './discovery/product-discovery.service';
import { ProductIntelligenceEnrichmentService } from './discovery/product-intelligence-enrichment.service';
import { ProductIntelligenceClient } from './integrations/product-intelligence.client';
import { ProductLiveFactsClient } from './integrations/product-live-facts.client';
import { SearchBrainClient } from './integrations/search-brain.client';
import { ProductRecommendationCardService } from './recommendation/product-recommendation-card.service';
import { RecommendationScoringService } from './recommendation/recommendation-scoring.service';

@Module({
  controllers: [AiArmanController],
  providers: [
    AiArmanService,
    ChatConversationResultStore,
    ChatConversationStateStore,
    DisabledChatInterpretationShadowConfig,
    InMemoryChatInterpretationShadowAuditStore,
    {
      provide: ChatConversationResultRepository,
      useExisting: ChatConversationResultStore,
    },
    {
      provide: ChatConversationStateRepository,
      useExisting: ChatConversationStateStore,
    },
    {
      provide: ChatInterpretationShadowConfig,
      useExisting: DisabledChatInterpretationShadowConfig,
    },
    {
      provide: ChatInterpretationShadowAuditSink,
      useExisting: InMemoryChatInterpretationShadowAuditStore,
    },
    ChatConversationService,
    ChatInterpretationShadowOrchestrator,
    ChatInterpretationShadowService,
    ChatInterpretationValidator,
    ChatMessagesService,
    ChatPreviewService,
    ChatRequestParser,
    HaircareRecommendationJourneyService,
    ProductDiscoveryService,
    ProductIntelligenceEnrichmentService,
    ProductIntelligenceClient,
    ProductLiveFactsClient,
    ProductRecommendationCardService,
    SearchBrainClient,
    RecommendationScoringService,
  ],
  exports: [
    AiArmanService,
    ChatConversationResultRepository,
    ChatConversationStateRepository,
    ChatConversationService,
    ChatInterpretationShadowAuditSink,
    ChatInterpretationShadowConfig,
    ChatInterpretationShadowOrchestrator,
    ChatInterpretationShadowService,
    ChatInterpretationValidator,
    ChatMessagesService,
    ChatPreviewService,
    ChatRequestParser,
    HaircareRecommendationJourneyService,
    ProductDiscoveryService,
    ProductIntelligenceEnrichmentService,
    ProductIntelligenceClient,
    ProductLiveFactsClient,
    ProductRecommendationCardService,
    SearchBrainClient,
    RecommendationScoringService,
  ],
})
export class AiArmanModule {}
