import { RecommendationScoringService } from './recommendation-scoring.service';
import { RecommendationCandidate } from './recommendation.types';

function candidate(
  overrides: Partial<RecommendationCandidate> = {},
): RecommendationCandidate {
  return {
    productId: 'product-1',
    title: 'Test Product',
    scores: {
      designation: 90,
      inciSuitability: 90,
      category: 80,
      tags: 70,
    },
    personalizationScore: 0,
    evidence: {
      designationReasons: ['correct_product_type'],
      inciSignals: ['humectants'],
      categoryReasons: ['correct_category'],
      tagReasons: [],
      limitations: [],
      confidence: 90,
      engineVersion: 'test-v1',
    },
    ...overrides,
  };
}

describe('RecommendationScoringService', () => {
  const service = new RecommendationScoringService();

  it('scores designation and INCI as equal joint priority one', () => {
    const result = service.scoreCandidate(candidate());

    expect(result.qualityScore).toBe(85.5);
    expect(result.tier).toBe('A');
    expect(result.eligible).toBe(true);
  });

  it('rejects a product that fails the designation gate despite a high total', () => {
    const result = service.scoreCandidate(
      candidate({
        scores: {
          designation: 59,
          inciSuitability: 100,
          category: 100,
          tags: 100,
        },
      }),
    );

    expect(result.eligible).toBe(false);
    expect(result.tier).toBe('REJECTED');
    expect(result.rejectionReasons).toContain('designation_gate_failed');
  });

  it('rejects a product that fails the INCI gate despite popularity', () => {
    const result = service.scoreCandidate(
      candidate({
        personalizationScore: 100,
        scores: {
          designation: 100,
          inciSuitability: 54,
          category: 100,
          tags: 100,
        },
      }),
    );

    expect(result.eligible).toBe(false);
    expect(result.rejectionReasons).toContain('inci_gate_failed');
  });

  it('rejects hard blockers regardless of numeric score', () => {
    const result = service.scoreCandidate(
      candidate({ hardBlockers: ['verified_allergen_conflict'] }),
    );

    expect(result.eligible).toBe(false);
    expect(result.rejectionReasons).toContain(
      'hard_blocker:verified_allergen_conflict',
    );
  });

  it('never lets personalization lift a lower tier above a higher tier', () => {
    const tierA = candidate({
      productId: 'tier-a',
      personalizationScore: 0,
      scores: {
        designation: 90,
        inciSuitability: 90,
        category: 85,
        tags: 80,
      },
    });

    const tierBPopular = candidate({
      productId: 'tier-b-popular',
      personalizationScore: 100,
      scores: {
        designation: 78,
        inciSuitability: 76,
        category: 75,
        tags: 80,
      },
    });

    const ranked = service.rankCandidates([tierBPopular, tierA]);

    expect(ranked.map((item) => item.productId)).toEqual([
      'tier-a',
      'tier-b-popular',
    ]);
  });

  it('places rejected candidates after eligible candidates', () => {
    const rejected = candidate({
      productId: 'rejected',
      scores: {
        designation: 10,
        inciSuitability: 100,
        category: 100,
        tags: 100,
      },
    });

    const eligible = candidate({ productId: 'eligible' });
    const ranked = service.rankCandidates([rejected, eligible]);

    expect(ranked[0].productId).toBe('eligible');
    expect(ranked[1].tier).toBe('REJECTED');
  });
});
