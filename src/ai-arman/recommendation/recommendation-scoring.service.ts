import { Injectable } from '@nestjs/common';
import {
  RecommendationCandidate,
  RecommendationGates,
  RecommendationTier,
  RecommendationWeights,
  ScoredRecommendationCandidate,
} from './recommendation.types';

const DEFAULT_WEIGHTS: RecommendationWeights = {
  designation: 0.35,
  inciSuitability: 0.35,
  category: 0.2,
  tags: 0.1,
};

const DEFAULT_GATES: RecommendationGates = {
  minimumDesignation: 60,
  minimumInciSuitability: 55,
  minimumQuality: 60,
};

const MAX_PERSONALIZATION_SCORE = 100;
const QUALITY_RANKING_WEIGHT = 0.9;
const PERSONALIZATION_RANKING_WEIGHT = 0.1;

@Injectable()
export class RecommendationScoringService {
  scoreCandidate(
    candidate: RecommendationCandidate,
    weights: RecommendationWeights = DEFAULT_WEIGHTS,
    gates: RecommendationGates = DEFAULT_GATES,
  ): ScoredRecommendationCandidate {
    this.assertValidWeights(weights);

    const normalizedScores = {
      designation: this.clampScore(candidate.scores.designation),
      inciSuitability: this.clampScore(candidate.scores.inciSuitability),
      category: this.clampScore(candidate.scores.category),
      tags: this.clampScore(candidate.scores.tags),
    };

    const qualityScore = this.round(
      normalizedScores.designation * weights.designation
        + normalizedScores.inciSuitability * weights.inciSuitability
        + normalizedScores.category * weights.category
        + normalizedScores.tags * weights.tags,
    );

    const boundedPersonalizationScore = this.clampScore(
      candidate.personalizationScore ?? 0,
      MAX_PERSONALIZATION_SCORE,
    );

    const rankingScore = this.round(
      qualityScore * QUALITY_RANKING_WEIGHT
        + boundedPersonalizationScore * PERSONALIZATION_RANKING_WEIGHT,
    );

    const rejectionReasons: string[] = [];

    if (normalizedScores.designation < gates.minimumDesignation) {
      rejectionReasons.push('designation_gate_failed');
    }

    if (normalizedScores.inciSuitability < gates.minimumInciSuitability) {
      rejectionReasons.push('inci_gate_failed');
    }

    if (qualityScore < gates.minimumQuality) {
      rejectionReasons.push('minimum_quality_failed');
    }

    for (const blocker of candidate.hardBlockers ?? []) {
      rejectionReasons.push(`hard_blocker:${blocker}`);
    }

    const eligible = rejectionReasons.length === 0;
    const tier = eligible ? this.resolveTier(qualityScore) : 'REJECTED';

    return {
      ...candidate,
      scores: normalizedScores,
      qualityScore,
      rankingScore,
      tier,
      eligible,
      rejectionReasons,
      boundedPersonalizationScore,
    };
  }

  rankCandidates(
    candidates: RecommendationCandidate[],
  ): ScoredRecommendationCandidate[] {
    return candidates
      .map((candidate) => this.scoreCandidate(candidate))
      .sort((left, right) => {
        if (left.eligible !== right.eligible) {
          return left.eligible ? -1 : 1;
        }

        const tierDifference = this.tierRank(left.tier) - this.tierRank(right.tier);
        if (tierDifference !== 0) {
          return tierDifference;
        }

        if (right.rankingScore !== left.rankingScore) {
          return right.rankingScore - left.rankingScore;
        }

        if (right.qualityScore !== left.qualityScore) {
          return right.qualityScore - left.qualityScore;
        }

        return left.productId.localeCompare(right.productId);
      });
  }

  private resolveTier(score: number): RecommendationTier {
    if (score >= 85) return 'A';
    if (score >= 70) return 'B';
    return 'C';
  }

  private tierRank(tier: RecommendationTier): number {
    const ranks: Record<RecommendationTier, number> = {
      A: 0,
      B: 1,
      C: 2,
      REJECTED: 3,
    };

    return ranks[tier];
  }

  private clampScore(value: number, maximum = 100): number {
    if (!Number.isFinite(value)) return 0;
    return Math.min(maximum, Math.max(0, value));
  }

  private assertValidWeights(weights: RecommendationWeights): void {
    const total =
      weights.designation
      + weights.inciSuitability
      + weights.category
      + weights.tags;

    if (Math.abs(total - 1) > 0.000001) {
      throw new Error('Recommendation weights must sum to 1.');
    }

    if (Object.values(weights).some((weight) => weight < 0)) {
      throw new Error('Recommendation weights must not be negative.');
    }
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
