import { Injectable } from '@nestjs/common';
import { ChatConversationStateRepository } from '../chat/chat-conversation.repositories';
import { ChatConversationService } from '../chat/chat-conversation.service';
import type {
  AiArmanChatRequest,
  AiArmanChatResponse,
  AiArmanSkincareActive,
  AiArmanSkincareRoutineActive,
} from '../chat/chat-messages.types';
import {
  extractSkincareSpecialistProfile,
  type SkincareAvoidanceContext,
  type SkincareSpecialistProfile,
} from './skincare-specialist-profile';
import { reviewSkincareRoutineSafety } from './skincare-routine-safety-review.service';

@Injectable()
export class SkincareSpecialistChatOrchestrator {
  constructor(
    private readonly conversations: ChatConversationService,
    private readonly stateStore: ChatConversationStateRepository,
  ) {}

  async handleWithShadow(input: AiArmanChatRequest): Promise<AiArmanChatResponse> {
    const previousState = input.conversationId?.trim()
      ? this.stateStore.get(input.conversationId.trim())
      : null;
    const previousProfile = previousState?.remembered.skincareSpecialistProfile;
    const response = await this.conversations.handleWithShadow(input);
    const effectiveDomain =
      response.interpretation.entities.recommendationDomain ??
      response.state.remembered.recommendationDomain ??
      previousState?.remembered.recommendationDomain ??
      null;

    if (effectiveDomain !== 'skincare') {
      const cleaned = clearSkincareSpecialistProfile(response);
      this.stateStore.save(cleaned.state);
      return cleaned;
    }

    const currentProfile = extractSkincareSpecialistProfile(input.message.text);
    const specialistProfile = mergeSkincareSpecialistProfiles(
      previousProfile,
      currentProfile,
    );
    const skincareRoutineActives = removeUnavailableRoutineActives(
      response.interpretation.entities.skincareRoutineActives ?? [],
      currentProfile.avoidanceContexts,
      input.message.text,
    );
    const state = {
      ...response.state,
      remembered: {
        ...response.state.remembered,
        skincareRoutineActives,
        skincareSpecialistProfile: specialistProfile,
      },
    };
    const integrated: AiArmanChatResponse = {
      ...response,
      interpretation: {
        ...response.interpretation,
        entities: {
          ...response.interpretation.entities,
          skincareRoutineActives,
          skincareSpecialistProfile: specialistProfile,
        },
      },
      state,
      safety: {
        ...response.safety,
        skincareRoutineReview: reviewSkincareRoutineSafety({
          needs: response.interpretation.entities.needs,
          actives: skincareRoutineActives,
        }),
      },
    };

    this.stateStore.save(integrated.state);
    return integrated;
  }
}

export function mergeSkincareSpecialistProfiles(
  previous: SkincareSpecialistProfile | undefined,
  current: SkincareSpecialistProfile,
): SkincareSpecialistProfile {
  const routinePositions = unique([
    ...(previous?.routinePositions ?? []),
    ...current.routinePositions,
  ]);
  const explicitRoutinePositions = routinePositions.filter(
    (position) => position !== 'unspecified',
  );

  return {
    version: 'skincare-specialist-profile-v1',
    barrierSignals: unique([
      ...(previous?.barrierSignals ?? []),
      ...current.barrierSignals,
    ]),
    pigmentationConcerns: unique([
      ...(previous?.pigmentationConcerns ?? []),
      ...current.pigmentationConcerns,
    ]),
    routinePositions:
      explicitRoutinePositions.length > 0
        ? explicitRoutinePositions
        : ['unspecified'],
    avoidanceContexts: uniqueAvoidanceContexts([
      ...(previous?.avoidanceContexts ?? []),
      ...current.avoidanceContexts,
    ]),
  };
}

function removeUnavailableRoutineActives(
  actives: AiArmanSkincareRoutineActive[],
  avoidanceContexts: SkincareAvoidanceContext[],
  rawText: string,
): AiArmanSkincareRoutineActive[] {
  const unavailableActives = new Set<AiArmanSkincareActive>([
    ...avoidanceContexts
      .map((item) => avoidanceSubjectToActive(item.subject))
      .filter((active): active is AiArmanSkincareActive => Boolean(active)),
    ...detectNegatedOrStoppedRoutineActives(rawText),
  ]);
  if (unavailableActives.size === 0) return actives;
  return actives.filter((item) => !unavailableActives.has(item.active));
}

function detectNegatedOrStoppedRoutineActives(rawText: string): AiArmanSkincareActive[] {
  const value = normalize(rawText);
  const signals: Array<[RegExp, AiArmanSkincareActive]> = [
    [/retinol|retinal|retinoid|tretinoin/, 'retinoid'],
    [/\baha\b|glykolsyra|mjolksyra|glycolic acid|lactic acid/, 'aha'],
    [/\bbha\b|salicylsyra|salicylic acid/, 'bha'],
    [/\bpha\b|gluconolactone/, 'pha'],
    [/vitamin c|askorbinsyra|ascorbic acid/, 'vitamin_c'],
    [/niacinamid|niacinamide/, 'niacinamide'],
    [/azelainsyra|azelaic acid/, 'azelaic_acid'],
    [/bensoylperoxid|benzoyl peroxide/, 'benzoyl_peroxide'],
  ];

  return signals
    .filter(([pattern]) =>
      contextualMatch(
        value,
        pattern,
        /anvander inte|anvander ej|inte langre|slutat med|slutade med|har slutat|har slutat med/,
      ),
    )
    .map(([, active]) => active);
}

function avoidanceSubjectToActive(subject: string): AiArmanSkincareActive | null {
  const supported = new Set<AiArmanSkincareActive>([
    'retinoid',
    'aha',
    'bha',
    'vitamin_c',
    'niacinamide',
  ]);
  return supported.has(subject as AiArmanSkincareActive)
    ? (subject as AiArmanSkincareActive)
    : null;
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

function clearSkincareSpecialistProfile(
  response: AiArmanChatResponse,
): AiArmanChatResponse {
  const {
    skincareSpecialistProfile: _interpretationProfile,
    ...interpretationEntities
  } = response.interpretation.entities;
  const {
    skincareSpecialistProfile: _rememberedProfile,
    ...remembered
  } = response.state.remembered;

  return {
    ...response,
    interpretation: {
      ...response.interpretation,
      entities: interpretationEntities,
    },
    state: {
      ...response.state,
      remembered,
    },
  };
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
