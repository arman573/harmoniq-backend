import { CustomerFact } from './customer-fact.entity';
import { buildUnifiedBeautyProfile } from './unified-beauty-profile';

function fact({
  value,
  type = 'concern',
  confidence = 0.8,
  createdAt = new Date('2026-01-01T00:00:00.000Z'),
}: {
  value: string;
  type?: string;
  confidence?: number;
  createdAt?: Date;
}) {
  return {
    value,
    type,
    source: 'test',
    confidence,
    createdAt,
  } as CustomerFact;
}

describe('UnifiedBeautyProfile', () => {
  it('builds a skin profile from dry skin and sensitive skin facts', () => {
    const profile = buildUnifiedBeautyProfile(1, [
      fact({ value: 'dry_skin', type: 'concern' }),
      fact({ value: 'sensitive_skin', type: 'sensitivity' }),
    ]);

    expect(profile.customerId).toBe(1);
    expect(profile.domains.skin.signals.map((signal) => signal.key)).toEqual([
      'dry_skin',
      'sensitive_skin',
    ]);
    expect(profile.domains.skin.concerns.map((signal) => signal.key)).toEqual(
      expect.arrayContaining(['dry_skin', 'sensitive_skin']),
    );
    expect(
      profile.domains.skin.sensitivities.map((signal) => signal.key),
    ).toContain('sensitive_skin');
  });

  it('builds a hair profile from dry hair and sulfate-free facts', () => {
    const profile = buildUnifiedBeautyProfile(1, [
      fact({ value: 'dry_hair', type: 'concern' }),
      fact({ value: 'sulfate_free', type: 'preference' }),
    ]);

    expect(profile.domains.hair.concerns.map((signal) => signal.key)).toContain(
      'dry_hair',
    );
    expect(
      profile.domains.hair.preferences.map((signal) => signal.key),
    ).toContain('sulfate_free');
  });

  it('builds a fragrance profile from floral and migraine trigger facts', () => {
    const profile = buildUnifiedBeautyProfile(1, [
      fact({ value: 'floral', type: 'preference' }),
      fact({ value: 'migraine_trigger_risk', type: 'sensitivity' }),
    ]);

    expect(
      profile.domains.fragrance.preferences.map((signal) => signal.key),
    ).toContain('floral');
    expect(
      profile.domains.fragrance.sensitivities.map((signal) => signal.key),
    ).toContain('migraine_trigger_risk');
  });

  it('merges duplicate facts and increments evidence count', () => {
    const profile = buildUnifiedBeautyProfile(1, [
      fact({
        value: 'dry_skin',
        confidence: 0.55,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
      fact({
        value: 'dry_skin',
        confidence: 0.9,
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
      }),
    ]);
    const signal = profile.domains.skin.signals[0];

    expect(signal.evidenceCount).toBe(2);
    expect(signal.confidence).toBe(0.9);
    expect(signal.lastSeenAt).toEqual(new Date('2026-02-01T00:00:00.000Z'));
  });

  it('calculates high medium and low confidence levels', () => {
    const high = buildUnifiedBeautyProfile(1, [
      fact({ value: 'dry_skin', confidence: 0.85 }),
      fact({ value: 'sensitive_skin', confidence: 0.85 }),
    ]);
    const medium = buildUnifiedBeautyProfile(1, [
      fact({ value: 'dry_skin', confidence: 0.5 }),
    ]);
    const low = buildUnifiedBeautyProfile(1, []);

    expect(high.evidenceSummary.confidenceLevel).toBe('high');
    expect(medium.evidenceSummary.confidenceLevel).toBe('medium');
    expect(low.evidenceSummary.confidenceLevel).toBe('low');
  });

  it('puts unknown facts in the general domain', () => {
    const profile = buildUnifiedBeautyProfile(1, [
      fact({ value: 'unknown_signal', type: 'preference' }),
    ]);

    expect(profile.domains.general.signals.map((signal) => signal.key)).toEqual(
      ['unknown_signal'],
    );
    expect(profile.evidenceSummary.domainsDetected).toEqual(['general']);
  });
});
