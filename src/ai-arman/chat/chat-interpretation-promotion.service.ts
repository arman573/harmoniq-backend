import { BadRequestException, Injectable } from '@nestjs/common';
import { ChatInterpretationValidator } from './chat-interpretation.validator';
import { readChatInterpretationPromotionConfig } from './chat-interpretation-promotion.config';
import type {
  AiArmanBeautyDomain,
  AiArmanIntent,
  AiArmanInterpretation,
  AiArmanModelInterpretationCandidate,
  AiArmanProductType,
} from './chat-messages.types';

export type ChatInterpretationPromotionProposal = {
  primaryIntent: AiArmanIntent;
  secondaryIntents: AiArmanIntent[];
  confidence: number;
  requestedProductTypes: AiArmanProductType[];
  recommendationDomain: AiArmanBeautyDomain | null;
};

export type ChatInterpretationPromotionDecision =
  | {
      status: 'promote';
      proposal: ChatInterpretationPromotionProposal;
      reasons: string[];
    }
  | {
      status: 'keep_deterministic';
      proposal: null;
      reasons: string[];
    };

const IDENTITY_REQUIRED_INTENTS: AiArmanIntent[] = [
  'purchased_product_usage',
  'order_status',
  'tracking_status',
  'return_help',
  'claim_help',
];

@Injectable()
export class ChatInterpretationPromotionService {
  constructor(private readonly validator: ChatInterpretationValidator) {}

  evaluate(
    deterministic: AiArmanInterpretation,
    candidate: unknown,
  ): ChatInterpretationPromotionDecision {
    const config = readChatInterpretationPromotionConfig();
    if (!config.enabled) {
      return keep('model_promotion_disabled');
    }

    let parsed: AiArmanModelInterpretationCandidate;
    try {
      parsed = this.validator.parse(candidate);
    } catch (error) {
      if (error instanceof BadRequestException) {
        return keep('model_candidate_invalid');
      }
      throw error;
    }

    if (parsed.confidence < config.minConfidence) {
      return keep('model_candidate_below_confidence_gate');
    }

    if (parsed.entities.orderReference !== deterministic.entities.orderReference) {
      return keep('model_cannot_change_order_reference');
    }

    const expectedRequiresIdentity = IDENTITY_REQUIRED_INTENTS.includes(
      parsed.primaryIntent,
    );
    if (parsed.requiresIdentity !== expectedRequiresIdentity) {
      return keep('model_identity_requirement_mismatch');
    }

    if (parsed.requiresHumanReview !== (parsed.primaryIntent === 'human_handoff')) {
      return keep('model_human_review_requirement_mismatch');
    }

    if (
      deterministic.primaryIntent !== 'unknown' &&
      deterministic.primaryIntent !== 'greeting' &&
      parsed.primaryIntent !== deterministic.primaryIntent
    ) {
      return keep('model_cannot_override_known_deterministic_intent');
    }

    if (
      parsed.primaryIntent === 'unknown' &&
      deterministic.primaryIntent !== 'unknown'
    ) {
      return keep('model_unknown_cannot_replace_known_intent');
    }

    if (!productDomainIsConsistent(parsed)) {
      return keep('model_product_domain_inconsistent');
    }

    return {
      status: 'promote',
      proposal: {
        primaryIntent: parsed.primaryIntent,
        secondaryIntents: parsed.secondaryIntents,
        confidence: parsed.confidence,
        requestedProductTypes: parsed.entities.requestedProductTypes,
        recommendationDomain: parsed.entities.recommendationDomain ?? null,
      },
      reasons: [
        'model_candidate_validated',
        'critical_identity_fields_preserved',
        'backend_policy_still_required_before_tools',
      ],
    };
  }
}

function productDomainIsConsistent(
  candidate: AiArmanModelInterpretationCandidate,
): boolean {
  const productTypes = candidate.entities.requestedProductTypes;
  const domain = candidate.entities.recommendationDomain ?? null;
  if (productTypes.length === 0) return true;

  const inferred = unique(
    productTypes
      .map(productTypeDomain)
      .filter((value): value is AiArmanBeautyDomain => Boolean(value)),
  );
  if (inferred.length !== 1) return false;
  return domain === null || domain === inferred[0];
}

function productTypeDomain(
  type: AiArmanProductType,
): AiArmanBeautyDomain | null {
  switch (type) {
    case 'shampoo':
    case 'conditioner':
    case 'hair_mask':
    case 'leave_in':
      return 'haircare';
    case 'cleanser':
    case 'face_cream':
    case 'serum':
    case 'spf':
      return 'skincare';
    case 'fragrance':
      return 'fragrance';
    case 'foundation':
    case 'concealer':
    case 'lipstick':
    case 'mascara':
      return 'makeup';
    case 'nail_polish':
    case 'base_coat':
    case 'top_coat':
    case 'nail_treatment':
      return 'nails';
  }
}

function keep(reason: string): ChatInterpretationPromotionDecision {
  return {
    status: 'keep_deterministic',
    proposal: null,
    reasons: [reason],
  };
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
