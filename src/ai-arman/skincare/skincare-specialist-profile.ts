export type SkincareBarrierSignal =
  | 'barrier_support_requested'
  | 'stinging'
  | 'tightness'
  | 'flaking'
  | 'over_exfoliated';

export type SkincarePigmentationConcern =
  | 'dark_spots'
  | 'post_acne_marks'
  | 'uneven_tone';

export type SkincareRoutinePosition =
  | 'after_cleansing'
  | 'before_moisturizer'
  | 'after_moisturizer'
  | 'before_spf'
  | 'unspecified';

export type SkincareAvoidanceReason =
  | 'preference'
  | 'prior_reaction'
  | 'sensitivity';

export type SkincareAvoidanceContext = {
  subject: string;
  reason: SkincareAvoidanceReason;
};

export type SkincareSpecialistProfile = {
  version: 'skincare-specialist-profile-v1';
  barrierSignals: SkincareBarrierSignal[];
  pigmentationConcerns: SkincarePigmentationConcern[];
  routinePositions: SkincareRoutinePosition[];
  avoidanceContexts: SkincareAvoidanceContext[];
};

const MAX_AVOIDANCE_SUBJECT_LENGTH = 80;

export function extractSkincareSpecialistProfile(
  rawText: string,
): SkincareSpecialistProfile {
  const value = normalize(rawText);
  const barrierSignals: SkincareBarrierSignal[] = [];
  const pigmentationConcerns: SkincarePigmentationConcern[] = [];
  const routinePositions: SkincareRoutinePosition[] = [];
  const avoidanceContexts: SkincareAvoidanceContext[] = [];

  if (/starka hudbarriaren|starkare hudbarriar|reparera hudbarriaren|barriarstod/.test(value)) {
    barrierSignals.push('barrier_support_requested');
  }
  if (/huden svider|svider i huden|svider latt|branner i huden/.test(value)) {
    barrierSignals.push('stinging');
  }
  if (/huden stramar|stram hud|kanns stram/.test(value)) {
    barrierSignals.push('tightness');
  }
  if (/flagnar|fjallar|flagig hud|fjallig hud/.test(value)) {
    barrierSignals.push('flaking');
  }
  if (/overexfolierad|over exfolierad|exfolierat for mycket|for mycket syra/.test(value)) {
    barrierSignals.push('over_exfoliated');
  }

  if (/pigmentflack|morka flack|solflack|dark spot/.test(value)) {
    pigmentationConcerns.push('dark_spots');
  }
  if (/marken efter finnar|aknemarken|post acne|post-acne/.test(value)) {
    pigmentationConcerns.push('post_acne_marks');
  }
  if (/ojamn hudton|ojamn ton|uneven tone/.test(value)) {
    pigmentationConcerns.push('uneven_tone');
  }

  if (/efter rengoring|direkt efter rengoring/.test(value)) {
    routinePositions.push('after_cleansing');
  }
  if (/fore fuktkram|innan fuktkram|fore ansiktskram|innan ansiktskram/.test(value)) {
    routinePositions.push('before_moisturizer');
  }
  if (/efter fuktkram|efter ansiktskram/.test(value)) {
    routinePositions.push('after_moisturizer');
  }
  if (/fore spf|innan spf|fore solskydd|innan solskydd/.test(value)) {
    routinePositions.push('before_spf');
  }

  avoidanceContexts.push(...extractAvoidanceContexts(value));

  return {
    version: 'skincare-specialist-profile-v1',
    barrierSignals: unique(barrierSignals),
    pigmentationConcerns: unique(pigmentationConcerns),
    routinePositions:
      routinePositions.length > 0 ? unique(routinePositions) : ['unspecified'],
    avoidanceContexts: uniqueAvoidanceContexts(avoidanceContexts),
  };
}

export function validateSkincareSpecialistProfile(
  profile: SkincareSpecialistProfile,
): SkincareSpecialistProfile {
  if (profile.version !== 'skincare-specialist-profile-v1') {
    throw new Error('invalid_skincare_specialist_profile_version');
  }
  if (profile.routinePositions.length === 0) {
    throw new Error('skincare_routine_position_required');
  }
  for (const item of profile.avoidanceContexts) {
    if (!item.subject.trim() || item.subject.length > MAX_AVOIDANCE_SUBJECT_LENGTH) {
      throw new Error('invalid_skincare_avoidance_subject');
    }
  }
  return profile;
}

function extractAvoidanceContexts(value: string): SkincareAvoidanceContext[] {
  const result: SkincareAvoidanceContext[] = [];
  const knownSubjects: Array<[RegExp, string]> = [
    [/parfym|fragrance/, 'fragrance'],
    [/retinol|retinal|retinoid/, 'retinoid'],
    [/aha|glykolsyra|mjolksyra/, 'aha'],
    [/bha|salicylsyra/, 'bha'],
    [/niacinamid|niacinamide/, 'niacinamide'],
    [/vitamin c|askorbinsyra/, 'vitamin_c'],
  ];

  for (const [pattern, subject] of knownSubjects) {
    if (!pattern.test(value)) continue;
    if (hasReactionLanguageNearSubject(value, pattern)) {
      result.push({ subject, reason: 'prior_reaction' });
      continue;
    }
    if (hasSensitivityLanguageNearSubject(value, pattern)) {
      result.push({ subject, reason: 'sensitivity' });
      continue;
    }
    if (hasAvoidanceLanguageNearSubject(value, pattern)) {
      result.push({ subject, reason: 'preference' });
    }
  }

  return result;
}

function hasReactionLanguageNearSubject(value: string, subject: RegExp): boolean {
  return contextualMatch(
    value,
    subject,
    /reagerar pa|reagerade pa|fick utslag av|blev rod av|sved av|tal inte|talde inte/,
  );
}

function hasSensitivityLanguageNearSubject(value: string, subject: RegExp): boolean {
  return contextualMatch(
    value,
    subject,
    /kanslig for|kanslig mot|overkanslig for|overkanslig mot/,
  );
}

function hasAvoidanceLanguageNearSubject(value: string, subject: RegExp): boolean {
  return contextualMatch(
    value,
    subject,
    /utan|undvika|vill inte ha|ingen|inget/,
  );
}

function contextualMatch(value: string, subject: RegExp, context: RegExp): boolean {
  const subjectMatch = value.match(subject);
  if (subjectMatch?.index === undefined) return false;
  const start = Math.max(0, subjectMatch.index - 48);
  const end = Math.min(value.length, subjectMatch.index + subjectMatch[0].length + 48);
  return context.test(value.slice(start, end));
}

function normalize(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function uniqueAvoidanceContexts(
  values: SkincareAvoidanceContext[],
): SkincareAvoidanceContext[] {
  const seen = new Set<string>();
  return values.filter((item) => {
    const key = `${item.subject}:${item.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
