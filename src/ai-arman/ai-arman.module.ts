import { Module } from '@nestjs/common';
import { AiArmanController } from './ai-arman.controller';
import { AiArmanService } from './ai-arman.service';
import { RecommendationScoringService } from './recommendation/recommendation-scoring.service';

@Module({
  controllers: [AiArmanController],
  providers: [AiArmanService, RecommendationScoringService],
  exports: [AiArmanService, RecommendationScoringService],
})
export class AiArmanModule {}
