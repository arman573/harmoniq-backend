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
import { ProductCardBlockMapper } from './chat/product-card-block.mapper';
import { HaircareRecommendationJourneyService } from './discovery/haircare-recommendation-journey.service';
import { ProductDiscoveryService } from './discovery/product-discovery.service';
import { ProductIntelligenceEnrichmentService } from './discovery/product-intelligence-enrichment.service';
import { ProductIntelligenceAuthProvider } from './integrations/product-intelligence-auth.provider';
import { ProductIntelligenceClient } from './integrations/product-intelligence.client';
import {
  InMemoryProductIntelligenceAuditStore,
  ProductIntelligenceAuditSink,
} from './integrations/product-intelligence-observability.store';
import {
  DisabledProductLiveFactsClient,
  ProductLiveFactsClient,
} from './integrations/product-live-facts.client';
import { readProductLiveFactsProviderConfig } from './integrations/product-live-facts-provider.config';
import { resolveProductLiveFactsProvider } from './integrations/product-live-facts-provider.resolver';
import { SearchBrainClient } from './integrations/search-brain.client';
import { VendreProductLiveFactsClient } from './integrations/vendre-product-live-facts.client';
import { ProductRecommendationCardService } from './recommendation/product-recommendation-card.service';
import { RecommendationScoringService } from './recommendation/recommendation-scoring.service';
import { SkincareRoutineSafetyReviewService } from './skincare/skincare-routine-safety-review.service';
import { SkincareSpecialistChatOrchestrator } from './skincare/skincare-specialist-chat-orchestrator.service';

@Module({
  controllers: [AiArmanController],
  providers: [
    AiArmanService,
    ChatConversationResultStore,
    ChatConversationStateStore,
    DisabledChatInterpretationShadowConfig,
    DisabledProductLiveFactsClient,
    VendreProductLiveFactsClient,
    InMemoryChatInterpretationShadowAuditStore,
    InMemoryProductIntelligenceAuditStore,
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
    {
      provide: ProductIntelligenceAuditSink,
      useExisting: InMemoryProductIntelligenceAuditStore,
    },
    {
      provide: ProductLiveFactsClient,
      inject: [DisabledProductLiveFactsClient, VendreProductLiveFactsClient],
      useFactory: (
        disabled: DisabledProductLiveFactsClient,
        vendre: VendreProductLiveFactsClient,
      ) =>
        resolveProductLiveFactsProvider(readProductLiveFactsProviderConfig(), {
          disabled,
          vendre,
        }).provider,
    },
    ChatConversationService,
    ChatInterpretationShadowOrchestrator,
    ChatInterpretationShadowService,
    ChatInterpretationValidator,
    ChatMessagesService,
    ChatPreviewService,
    ChatRequestParser,
    ProductCardBlockMapper,
    HaircareRecommendationJourneyService,
    ProductDiscoveryService,
    ProductIntelligenceEnrichmentService,
    ProductIntelligenceAuthProvider,
    ProductIntelligenceClient,
    ProductRecommendationCardService,
    SearchBrainClient,
    RecommendationScoringService,
    SkincareRoutineSafetyReviewService,
    SkincareSpecialistChatOrchestrator,
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
    ProductCardBlockMapper,
    HaircareRecommendationJourneyService,
    ProductDiscoveryService,
    ProductIntelligenceAuditSink,
    ProductIntelligenceEnrichmentService,
    ProductIntelligenceClient,
    ProductLiveFactsClient,
    ProductRecommendationCardService,
    SearchBrainClient,
    RecommendationScoringService,
    SkincareRoutineSafetyReviewService,
    SkincareSpecialistChatOrchestrator,
  ],
})
export class AiArmanModule {}
