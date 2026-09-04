import { Injectable } from '@nestjs/common';
import type {
  AiArmanSkincareActive,
  AiArmanSkincareRoutineActive,
  AiArmanSkincareRoutineReview,
  AiArmanSkincareRoutineReviewFlag,
} from '../chat/chat-messages.types';

type SkincareRoutineSafetyReviewInput = {
  needs: string[];
  actives: AiArmanSkincareRoutineActive[];
};

const EXFOLIATING_ACIDS = new Set<AiArmanSkincareActive>(['aha', 'bha', 'pha']);
const POTENTIALLY_IRRITATING_ACTIVES = new Set<AiArmanSkincareActive>([
  'retinoid',
  'aha',
  'bha',
  'pha',
  'benzoyl_peroxide',
]);

export function reviewSkincareRoutineSafety(
  input: SkincareRoutineSafetyReviewInput,
): AiArmanSkincareRoutineReview {
  const actives = uniqueActives(input.actives);
  const activeNames = new Set(actives.map((item) => item.active));
  const potentiallyIrritating = actives.filter((item) =>
    POTENTIALLY_IRRITATING_ACTIVES.has(item.active),
  );
  const flags: AiArmanSkincareRoutineReviewFlag[] = [];

  if (
    activeNames.has('retinoid') &&
    [...EXFOLIATING_ACIDS].some((active) => activeNames.has(active))
  ) {
    flags.push('retinoid_with_exfoliating_acid');
  }

  if (potentiallyIrritating.some((item) => item.timing === 'unspecified')) {
    flags.push('potentially_irritating_active_timing_unspecified');
  }

  if (new Set(potentiallyIrritating.map((item) => item.active)).size >= 3) {
    flags.push('multiple_potentially_irritating_actives');
  }

  if (
    input.needs.includes('sensitive_skin') &&
    potentiallyIrritating.length > 0
  ) {
    flags.push('sensitive_skin_with_potentially_irritating_active');
  }

  const uniqueFlags = [...new Set(flags)];
  return {
    version: 'skincare-routine-safety-review-v1',
    status: uniqueFlags.length > 0 ? 'review_required' : 'clear',
    flags: uniqueFlags,
    requiresReview: uniqueFlags.length > 0,
    blocksRecommendation: false,
  };
}

@Injectable()
export class SkincareRoutineSafetyReviewService {
  review(input: SkincareRoutineSafetyReviewInput): AiArmanSkincareRoutineReview {
    return reviewSkincareRoutineSafety(input);
  }
}

function uniqueActives(
  values: AiArmanSkincareRoutineActive[],
): AiArmanSkincareRoutineActive[] {
  const seen = new Set<string>();
  const result: AiArmanSkincareRoutineActive[] = [];

  for (const item of values) {
    const key = `${item.active}:${item.timing}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}
