import { Body, Controller, Get, Post } from '@nestjs/common';
import { AiArmanService } from './ai-arman.service';
import { ChatPreviewService } from './chat/chat-preview.service';
import { ChatPreviewRequest } from './chat/chat-preview.types';
import { RecommendationCandidate } from './recommendation/recommendation.types';

@Controller('ai-arman')
export class AiArmanController {
  constructor(
    private readonly aiArmanService: AiArmanService,
    private readonly chatPreviewService: ChatPreviewService,
  ) {}

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

  @Post('chat/preview')
  previewChat(@Body() body: ChatPreviewRequest) {
    return this.chatPreviewService.compose(body);
  }
}
