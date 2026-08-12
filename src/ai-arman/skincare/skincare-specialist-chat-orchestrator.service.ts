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
    const skincareRoutineActives = removeAvoidedRoutineActives(
      response.interpretation.entities.skincareRoutineActives ?? [],
      currentProfile.avoidanceContexts,
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

function removeAvoidedRoutineActives(
  actives: AiArmanSkincareRoutineActive[],
  avoidanceContexts: SkincareAvoidanceContext[],
): AiArmanSkincareRoutineActive[] {
  const avoidedActives = new Set(
    avoidanceContexts
      .map((item) => avoidanceSubjectToActive(item.subject))
      .filter((active): active is AiArmanSkincareActive => Boolean(active)),
  );
  if (avoidedActives.size === 0) return actives;
  return actives.filter((item) => !avoidedActives.has(item.active));
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
