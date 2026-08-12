import type {
  AiArmanRoutineTiming,
  AiArmanSkincareActive,
  AiArmanSkincareRoutineActive,
} from './chat-messages.types';

type ActiveSignal = {
  pattern: RegExp;
  active: AiArmanSkincareActive;
};

type ActiveOccurrence = {
  active: AiArmanSkincareActive;
  index: number;
};

type TimingOccurrence = {
  timing: Exclude<AiArmanRoutineTiming, 'unspecified'>;
  index: number;
};

const ACTIVE_SIGNALS: ActiveSignal[] = [
  { pattern: /\bretinol\b|\bretinal\b|\bretinoid\b|\btretinoin\b/, active: 'retinoid' },
  { pattern: /\baha\b|glykolsyra|mjolksyra|glycolic acid|lactic acid/, active: 'aha' },
  { pattern: /\bbha\b|salicylsyra|salicylic acid/, active: 'bha' },
  { pattern: /\bpha\b|gluconolactone/, active: 'pha' },
  { pattern: /vitamin c|askorbinsyra|ascorbic acid/, active: 'vitamin_c' },
  { pattern: /niacinamid|niacinamide/, active: 'niacinamide' },
  { pattern: /azelainsyra|azelaic acid/, active: 'azelaic_acid' },
  { pattern: /bensoylperoxid|benzoyl peroxide/, active: 'benzoyl_peroxide' },
];

const TIMING_SIGNALS: Array<{
  pattern: RegExp;
  timing: Exclude<AiArmanRoutineTiming, 'unspecified'>;
}> = [
  { pattern: /\bmorgon\b|\bpa morgonen\b|\bdagtid\b/g, timing: 'morning' },
  { pattern: /\bkvall\b|\bpa kvallen\b|\bnattetid\b/g, timing: 'evening' },
];

export function detectSkincareRoutineActivesWithTiming(
  value: string,
): AiArmanSkincareRoutineActive[] {
  const actives = findActiveOccurrences(value);
  if (actives.length === 0) return [];

  const timings = findTimingOccurrences(value);
  if (timings.length === 0) {
    return actives.map(({ active }) => ({ active, timing: 'unspecified' }));
  }

  const uniqueMessageTimings = unique(timings.map((item) => item.timing));
  if (uniqueMessageTimings.length === 1) {
    return actives.map(({ active }) => ({
      active,
      timing: uniqueMessageTimings[0],
    }));
  }

  return actives.map((item, index) => {
    const previous = actives[index - 1];
    const next = actives[index + 1];
    const leftBoundary = previous
      ? midpoint(previous.index, item.index)
      : 0;
    const rightBoundary = next
      ? midpoint(item.index, next.index)
      : value.length;
    const localTimings = unique(
      timings
        .filter(
          (timing) =>
            timing.index >= leftBoundary && timing.index < rightBoundary,
        )
        .map((timing) => timing.timing),
    );

    return {
      active: item.active,
      timing: localTimings.length === 1 ? localTimings[0] : 'unspecified',
    };
  });
}

function findActiveOccurrences(value: string): ActiveOccurrence[] {
  return ACTIVE_SIGNALS.flatMap(({ pattern, active }) => {
    const match = value.match(pattern);
    return match?.index === undefined ? [] : [{ active, index: match.index }];
  }).sort((left, right) => left.index - right.index);
}

function findTimingOccurrences(value: string): TimingOccurrence[] {
  const timings: TimingOccurrence[] = [];
  for (const { pattern, timing } of TIMING_SIGNALS) {
    pattern.lastIndex = 0;
    for (const match of value.matchAll(pattern)) {
      if (match.index === undefined) continue;
      timings.push({ timing, index: match.index });
    }
  }
  return timings.sort((left, right) => left.index - right.index);
}

function midpoint(left: number, right: number) {
  return left + Math.floor((right - left) / 2);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
