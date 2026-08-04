import { Injectable } from '@nestjs/common';
import { RecommendationScoringService } from './recommendation/recommendation-scoring.service';

@Injectable()
export class AiArmanService {
  constructor(
    private readonly recommendationScoring: RecommendationScoringService,
  ) {}

  getFoundationStatus() {
    return {
      ok: true,
      service: 'ai-arman',
      phase: 'foundation-v1',
      productionActionsEnabled: false,
      recommendation: {
        priorityOne: ['designation', 'inciSuitability'],
        weights: {
          designation: 0.35,
          inciSuitability: 0.35,
          category: 0.2,
          tags: 0.1,
        },
        gates: {
          minimumDesignation: 60,
          minimumInciSuitability: 55,
          minimumQuality: 60,
        },
        personalizationRule:
          'Hello Retail may only influence ordering after quality approval and may not lift a lower quality tier above a higher tier.',
      },
      availableFoundationComponents: {
        deterministicScoring: Boolean(this.recommendationScoring),
        liveProductTools: false,
        orderTools: false,
        caseWriteTools: false,
        publicChatWidget: false,
      },
    };
  }
}
