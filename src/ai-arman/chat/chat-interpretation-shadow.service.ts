import { Injectable } from '@nestjs/common';
import { ChatInterpretationValidator } from './chat-interpretation.validator';
import type {
  AiArmanInterpretation,
  AiArmanModelInterpretationCandidate,
} from './chat-messages.types';

export type ChatInterpretationShadowComparison = {
  status: 'valid_candidate' | 'invalid_candidate';
  candidateSource: 'model_candidate' | null;
  primaryIntentMatch: boolean | null;
  secondaryIntentOverlap: number | null;
  requestedProductTypeOverlap: number | null;
  needOverlap: number | null;
  exclusionOverlap: number | null;
  orderReferenceMatch: boolean | null;
  requiresIdentityMatch: boolean | null;
  requiresHumanReviewMatch: boolean | null;
  confidenceDelta: number | null;
  affectsCustomerResponse: false;
  affectsState: false;
  affectsTools: false;
};

@Injectable()
export class ChatInterpretationShadowService {
  constructor(private readonly validator: ChatInterpretationValidator) {}

  compare(
    deterministic: AiArmanInterpretation,
    candidate: unknown,
  ): ChatInterpretationShadowComparison {
    let parsed: AiArmanModelInterpretationCandidate;

    try {
      parsed = this.validator.parse(candidate);
    } catch {
      return invalidComparison();
    }

    return {
      status: 'valid_candidate',
      candidateSource: parsed.source,
      primaryIntentMatch:
        deterministic.primaryIntent === parsed.primaryIntent,
      secondaryIntentOverlap: overlapRatio(
        deterministic.secondaryIntents,
        parsed.secondaryIntents,
      ),
      requestedProductTypeOverlap: overlapRatio(
        deterministic.entities.requestedProductTypes,
        parsed.entities.requestedProductTypes,
      ),
      needOverlap: overlapRatio(
        deterministic.entities.needs,
        parsed.entities.needs,
      ),
      exclusionOverlap: overlapRatio(
        deterministic.entities.exclusions,
        parsed.entities.exclusions,
      ),
      orderReferenceMatch:
        deterministic.entities.orderReference === parsed.entities.orderReference,
      requiresIdentityMatch:
        deterministic.requiresIdentity === parsed.requiresIdentity,
      requiresHumanReviewMatch:
        deterministic.requiresHumanReview === parsed.requiresHumanReview,
      confidenceDelta: round(parsed.confidence - deterministic.confidence),
      affectsCustomerResponse: false,
      affectsState: false,
      affectsTools: false,
    };
  }
}

function invalidComparison(): ChatInterpretationShadowComparison {
  return {
    status: 'invalid_candidate',
    candidateSource: null,
    primaryIntentMatch: null,
    secondaryIntentOverlap: null,
    requestedProductTypeOverlap: null,
    needOverlap: null,
    exclusionOverlap: null,
    orderReferenceMatch: null,
    requiresIdentityMatch: null,
    requiresHumanReviewMatch: null,
    confidenceDelta: null,
    affectsCustomerResponse: false,
    affectsState: false,
    affectsTools: false,
  };
}

function overlapRatio(left: string[], right: string[]): number {
  const union = new Set([...left, ...right]);
  if (union.size === 0) return 1;

  const rightValues = new Set(right);
  const intersection = new Set(left.filter((value) => rightValues.has(value)));
  return round(intersection.size / union.size);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
