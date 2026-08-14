import { Module } from '@nestjs/common';
import { AiArmanController } from './ai-arman.controller';
import { AiArmanService } from './ai-arman.service';
import { AuthenticatedAfterPurchaseChatOrchestrator } from './chat/authenticated-after-purchase-chat-orchestrator.service';
import { AuthenticatedCustomerChatOrchestrator } from './chat/authenticated-customer-chat-orchestrator.service';
import {
  ChatConversationResultRepository,
  ChatConversationStateRepository,
} from './chat/chat-conversation.repositories';
import { ChatConversationResultStore } from './chat/chat-conversation-result.store';
import { ChatConversationStateStore } from './chat/chat-conversation-state.store';
import { ChatConversationService } from './chat/chat-conversation.service';
import { ChatInterpretationProvider } from './chat/chat-interpretation.provider';
import { ChatInterpretationPromotionService } from './chat/chat-interpretation-promotion.service';
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
import { readAccountOrderVerificationConfig } from './identity/account-order-verification.config';
import { AuthenticatedAccountOrderAccessService } from './identity/authenticated-account-order-access.service';
import { ConversationCustomerVerificationStore } from './identity/conversation-customer-verification.store';
import {
  AccountOrderVerificationProvider,
  DisabledAccountOrderVerificationProvider,
  DisabledOrderEmailOtpVerificationProvider,
  OrderEmailOtpVerificationProvider,
} from './identity/customer-identity-verification.providers';
import { CustomerIdentityVerificationService } from './identity/customer-identity-verification.service';
import { VendreAccountOrderVerificationProvider } from './identity/vendre-account-order-verification.provider';
import { VerifiedCustomerContextStore } from './identity/verified-customer-context.store';
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
import { ReturnsModuleReadClient } from './integrations/returns-module-read.client';
import { ReturnsModuleReadTools } from './integrations/returns-module-read.tools';
import { SearchBrainClient } from './integrations/search-brain.client';
import { TrackingReadClient } from './integrations/tracking-read.client';
import { VendreOrderReadClient } from './integrations/vendre-order-read.client';
import { VendreProductLiveFactsClient } from './integrations/vendre-product-live-facts.client';
import { VerifiedOrderReadService } from './integrations/verified-order-read.service';
import { VerifiedReturnsReadService } from './integrations/verified-returns-read.service';
import { VerifiedTrackingReadService } from './integrations/verified-tracking-read.service';
import { AiArmanModelInterpretationClient } from './model/model-interpretation.client';
import { OpenAiChatInterpretationProvider } from './model/openai-chat-interpretation.provider';
import { ProductRecommendationCardService } from './recommendation/product-recommendation-card.service';
import { RecommendationScoringService } from './recommendation/recommendation-scoring.service';
import { SkincareRoutineSafetyReviewService } from './skincare/skincare-routine-safety-review.service';
import { SkincareSpecialistChatOrchestrator } from './skincare/skincare-specialist-chat-orchestrator.service';

@Module({
  controllers: [AiArmanController],
  providers: [
    AiArmanService,
    AuthenticatedAfterPurchaseChatOrchestrator,
    AuthenticatedCustomerChatOrchestrator,
    ChatConversationResultStore,
    ChatConversationStateStore,
    DisabledChatInterpretationShadowConfig,
    DisabledProductLiveFactsClient,
    VendreProductLiveFactsClient,
    InMemoryChatInterpretationShadowAuditStore,
    InMemoryProductIntelligenceAuditStore,
    VerifiedCustomerContextStore,
    ConversationCustomerVerificationStore,
    DisabledOrderEmailOtpVerificationProvider,
    DisabledAccountOrderVerificationProvider,
    VendreAccountOrderVerificationProvider,
    VendreOrderReadClient,
    TrackingReadClient,
    AiArmanModelInterpretationClient,
    OpenAiChatInterpretationProvider,
    {
      provide: ChatInterpretationProvider,
      useExisting: OpenAiChatInterpretationProvider,
    },
    {
      provide: OrderEmailOtpVerificationProvider,
      useExisting: DisabledOrderEmailOtpVerificationProvider,
    },
    {
      provide: AccountOrderVerificationProvider,
      inject: [
        DisabledAccountOrderVerificationProvider,
        VendreAccountOrderVerificationProvider,
      ],
      useFactory: (
        disabled: DisabledAccountOrderVerificationProvider,
        vendre: VendreAccountOrderVerificationProvider,
      ) =>
        readAccountOrderVerificationConfig().activationAllowed
          ? vendre
          : disabled,
    },
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
    AuthenticatedAccountOrderAccessService,
    ChatConversationService,
    ChatInterpretationPromotionService,
    ChatInterpretationShadowOrchestrator,
    ChatInterpretationShadowService,
    ChatInterpretationValidator,
    ChatMessagesService,
    ChatPreviewService,
    ChatRequestParser,
    CustomerIdentityVerificationService,
    ProductCardBlockMapper,
    HaircareRecommendationJourneyService,
    ProductDiscoveryService,
    ProductIntelligenceEnrichmentService,
    ProductIntelligenceAuthProvider,
    ProductIntelligenceClient,
    ProductRecommendationCardService,
    ReturnsModuleReadClient,
    ReturnsModuleReadTools,
    SearchBrainClient,
    RecommendationScoringService,
    SkincareRoutineSafetyReviewService,
    SkincareSpecialistChatOrchestrator,
    VerifiedOrderReadService,
    VerifiedReturnsReadService,
    VerifiedTrackingReadService,
  ],
  exports: [
    AiArmanService,
    AuthenticatedAfterPurchaseChatOrchestrator,
    AuthenticatedCustomerChatOrchestrator,
    AuthenticatedAccountOrderAccessService,
    ChatConversationResultRepository,
    ChatConversationStateRepository,
    ChatConversationService,
    ChatInterpretationProvider,
    ChatInterpretationPromotionService,
    ChatInterpretationShadowAuditSink,
    ChatInterpretationShadowConfig,
    ChatInterpretationShadowOrchestrator,
    ChatInterpretationShadowService,
    ChatInterpretationValidator,
    ChatMessagesService,
    ChatPreviewService,
    ChatRequestParser,
    ConversationCustomerVerificationStore,
    CustomerIdentityVerificationService,
    ProductCardBlockMapper,
    HaircareRecommendationJourneyService,
    ProductDiscoveryService,
    ProductIntelligenceAuditSink,
    ProductIntelligenceEnrichmentService,
    ProductIntelligenceClient,
    ProductLiveFactsClient,
    ProductRecommendationCardService,
    ReturnsModuleReadClient,
    ReturnsModuleReadTools,
    SearchBrainClient,
    RecommendationScoringService,
    SkincareRoutineSafetyReviewService,
    SkincareSpecialistChatOrchestrator,
    VendreOrderReadClient,
    VerifiedCustomerContextStore,
    VerifiedOrderReadService,
    VerifiedReturnsReadService,
    VerifiedTrackingReadService,
  ],
})
export class AiArmanModule {}
