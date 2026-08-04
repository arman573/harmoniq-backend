import { Module } from '@nestjs/common';
import { AiArmanController } from './ai-arman.controller';
import { AiArmanService } from './ai-arman.service';
import { ChatPreviewService } from './chat/chat-preview.service';
import { RecommendationScoringService } from './recommendation/recommendation-scoring.service';

@Module({
  controllers: [AiArmanController],
  providers: [
    AiArmanService,
    ChatPreviewService,
    RecommendationScoringService,
  ],
  exports: [
    AiArmanService,
    ChatPreviewService,
    RecommendationScoringService,
  ],
})
export class AiArmanModule {}
