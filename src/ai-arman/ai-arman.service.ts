import { BadRequestException, Injectable } from '@nestjs/common';
import { RecommendationScoringService } from './recommendation/recommendation-scoring.service';
import { RecommendationCandidate } from './recommendation/recommendation.types';

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
          'Hello Retail may influence ordering inside the same approved quality tier, but may never lift a lower tier above a higher tier.',
      },
      availableFoundationComponents: {
        deterministicScoring: Boolean(this.recommendationScoring),
        recommendationPreview: true,
        deterministicChatPreview: true,
        liveProductTools: false,
        orderTools: false,
        caseWriteTools: false,
        publicChatWidget: false,
      },
    };
  }

  previewRecommendations(candidates: RecommendationCandidate[]) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      throw new BadRequestException('At least one recommendation candidate is required.');
    }

    if (candidates.length > 100) {
      throw new BadRequestException('A preview may contain at most 100 candidates.');
    }

    for (const candidate of candidates) {
      this.assertCandidate(candidate);
    }

    const ranked = this.recommendationScoring.rankCandidates(candidates);
    const eligible = ranked.filter((candidate) => candidate.eligible);
    const rejected = ranked.filter((candidate) => !candidate.eligible);

    return {
      ok: true,
      mode: 'preview',
      liveFactsUsed: false,
      productionActionsEnabled: false,
      summary: {
        received: candidates.length,
        eligible: eligible.length,
        rejected: rejected.length,
      },
      recommendations: eligible.slice(0, 3),
      rejected,
    };
  }

  private assertCandidate(candidate: RecommendationCandidate): void {
    if (!candidate || typeof candidate !== 'object') {
      throw new BadRequestException('Every candidate must be an object.');
    }

    if (!String(candidate.productId || '').trim()) {
      throw new BadRequestException('Every candidate requires productId.');
    }

    if (!String(candidate.title || '').trim()) {
      throw new BadRequestException('Every candidate requires title.');
    }

    const scoreNames = ['designation', 'inciSuitability', 'category', 'tags'] as const;

    for (const scoreName of scoreNames) {
      if (!Number.isFinite(candidate.scores?.[scoreName])) {
        throw new BadRequestException(
          `Candidate ${candidate.productId} has an invalid ${scoreName} score.`,
        );
      }
    }

    if (!candidate.evidence || typeof candidate.evidence !== 'object') {
      throw new BadRequestException(
        `Candidate ${candidate.productId} requires recommendation evidence.`,
      );
    }
  }
}
