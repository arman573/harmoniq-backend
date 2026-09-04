import {
  extractSkincareSpecialistProfile,
  validateSkincareSpecialistProfile,
} from './skincare-specialist-profile';

describe('Skincare specialist profile v1', () => {
  it('captures barrier symptoms without inferring a diagnosis', () => {
    const profile = extractSkincareSpecialistProfile(
      'Min hud svider, känns stram och flagnar efter rengöring.',
    );

    expect(profile.barrierSignals).toEqual(
      expect.arrayContaining(['stinging', 'tightness', 'flaking']),
    );
    expect(profile.routinePositions).toContain('after_cleansing');
  });

  it('captures explicit barrier support and over-exfoliation language', () => {
    const profile = extractSkincareSpecialistProfile(
      'Jag vill stärka hudbarriären. Jag tror att jag exfolierat för mycket med syra.',
    );

    expect(profile.barrierSignals).toEqual(
      expect.arrayContaining(['barrier_support_requested', 'over_exfoliated']),
    );
  });

  it('captures pigmentation concerns separately', () => {
    const profile = extractSkincareSpecialistProfile(
      'Jag har mörka fläckar, märken efter finnar och ojämn hudton.',
    );

    expect(profile.pigmentationConcerns).toEqual(
      expect.arrayContaining(['dark_spots', 'post_acne_marks', 'uneven_tone']),
    );
  });

  it('captures routine position and defaults to unspecified when absent', () => {
    const positioned = extractSkincareSpecialistProfile(
      'Jag använder serum efter rengöring, före fuktkräm och innan SPF.',
    );
    const unspecified = extractSkincareSpecialistProfile(
      'Jag använder ett serum varje dag.',
    );

    expect(positioned.routinePositions).toEqual(
      expect.arrayContaining([
        'after_cleansing',
        'before_moisturizer',
        'before_spf',
      ]),
    );
    expect(unspecified.routinePositions).toEqual(['unspecified']);
  });

  it.each([
    [
      'Jag reagerar på retinol och vill inte använda det igen.',
      { subject: 'retinoid', reason: 'prior_reaction' },
    ],
    [
      'Jag är känslig mot parfym i hudvård.',
      { subject: 'fragrance', reason: 'sensitivity' },
    ],
    [
      'Jag vill undvika niacinamid.',
      { subject: 'niacinamide', reason: 'preference' },
    ],
  ])('captures avoidance context for %s', (text, expected) => {
    const profile = extractSkincareSpecialistProfile(text);
    expect(profile.avoidanceContexts).toContainEqual(expected);
  });

  it('does not classify normal active use as an avoidance', () => {
    const profile = extractSkincareSpecialistProfile(
      'Jag använder retinol på kvällen och niacinamid på morgonen.',
    );

    expect(profile.avoidanceContexts).toEqual([]);
  });

  it('validates a complete extracted profile', () => {
    const profile = extractSkincareSpecialistProfile(
      'Jag vill undvika parfym och använder serum före fuktkräm.',
    );

    expect(validateSkincareSpecialistProfile(profile)).toEqual(profile);
  });

  it('rejects invalid version, missing routine position and invalid avoidance subjects', () => {
    const valid = extractSkincareSpecialistProfile('Jag söker hudvård.');

    expect(() =>
      validateSkincareSpecialistProfile({
        ...valid,
        version: 'wrong-version' as typeof valid.version,
      }),
    ).toThrow('invalid_skincare_specialist_profile_version');

    expect(() =>
      validateSkincareSpecialistProfile({
        ...valid,
        routinePositions: [],
      }),
    ).toThrow('skincare_routine_position_required');

    expect(() =>
      validateSkincareSpecialistProfile({
        ...valid,
        avoidanceContexts: [{ subject: '   ', reason: 'preference' }],
      }),
    ).toThrow('invalid_skincare_avoidance_subject');
  });
});
