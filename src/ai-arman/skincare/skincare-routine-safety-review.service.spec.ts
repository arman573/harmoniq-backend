import { SkincareRoutineSafetyReviewService } from './skincare-routine-safety-review.service';

describe('SkincareRoutineSafetyReviewService', () => {
  const service = new SkincareRoutineSafetyReviewService();

  it('keeps a simple non-irritating routine clear', () => {
    expect(
      service.review({
        needs: ['dry_skin'],
        actives: [
          { active: 'niacinamide', timing: 'morning' },
          { active: 'vitamin_c', timing: 'morning' },
        ],
      }),
    ).toEqual({
      version: 'skincare-routine-safety-review-v1',
      status: 'clear',
      flags: [],
      requiresReview: false,
      blocksRecommendation: false,
    });
  });

  it('flags retinoid with an exfoliating acid for review without declaring it forbidden', () => {
    const result = service.review({
      needs: ['dry_skin'],
      actives: [
        { active: 'retinoid', timing: 'evening' },
        { active: 'aha', timing: 'evening' },
      ],
    });

    expect(result.status).toBe('review_required');
    expect(result.flags).toContain('retinoid_with_exfoliating_acid');
    expect(result.requiresReview).toBe(true);
    expect(result.blocksRecommendation).toBe(false);
  });

  it('flags unknown timing for a potentially irritating active', () => {
    const result = service.review({
      needs: ['acne_prone_skin'],
      actives: [{ active: 'bha', timing: 'unspecified' }],
    });

    expect(result.flags).toContain(
      'potentially_irritating_active_timing_unspecified',
    );
  });

  it('flags a high load of potentially irritating actives', () => {
    const result = service.review({
      needs: ['acne_prone_skin'],
      actives: [
        { active: 'retinoid', timing: 'evening' },
        { active: 'bha', timing: 'morning' },
        { active: 'benzoyl_peroxide', timing: 'morning' },
      ],
    });

    expect(result.flags).toContain('multiple_potentially_irritating_actives');
  });

  it('adds extra review for sensitive skin with a potentially irritating active', () => {
    const result = service.review({
      needs: ['sensitive_skin'],
      actives: [{ active: 'retinoid', timing: 'evening' }],
    });

    expect(result.flags).toContain(
      'sensitive_skin_with_potentially_irritating_active',
    );
    expect(result.blocksRecommendation).toBe(false);
  });

  it('does not treat niacinamide or vitamin C alone as potentially irritating review triggers', () => {
    const result = service.review({
      needs: ['sensitive_skin'],
      actives: [
        { active: 'niacinamide', timing: 'unspecified' },
        { active: 'vitamin_c', timing: 'unspecified' },
      ],
    });

    expect(result.status).toBe('clear');
    expect(result.flags).toEqual([]);
  });
});
