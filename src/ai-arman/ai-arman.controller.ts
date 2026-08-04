import { Body, Controller, Get, Post } from '@nestjs/common';
import { AiArmanService } from './ai-arman.service';
import { RecommendationCandidate } from './recommendation/recommendation.types';

@Controller('ai-arman')
export class AiArmanController {
  constructor(private readonly aiArmanService: AiArmanService) {}

  @Get('foundation')
  getFoundationStatus() {
    return this.aiArmanService.getFoundationStatus();
  }

  @Post('recommendations/preview')
  previewRecommendations(
    @Body() body: { candidates?: RecommendationCandidate[] },
  ) {
    return this.aiArmanService.previewRecommendations(body?.candidates ?? []);
  }
}
