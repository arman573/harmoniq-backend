import { ChatInterpretationPromotionService } from './chat-interpretation-promotion.service';
import { ChatInterpretationValidator } from './chat-interpretation.validator';
import type {
  AiArmanInterpretation,
  AiArmanModelInterpretationCandidate,
} from './chat-messages.types';

const ORIGINAL_ENABLED = process.env.AI_ARMAN_MODEL_PROMOTION_ENABLED;
const ORIGINAL_CONFIDENCE =
  process.env.AI_ARMAN_MODEL_PROMOTION_MIN_CONFIDENCE;

function deterministic(
  overrides: Partial<AiArmanInterpretation> = {},
): AiArmanInterpretation {
  return {
    schemaVersion: 'ai-arman-interpretation-v1',
    source: 'deterministic_fallback',
    locale: 'sv-SE',
    primaryIntent: 'unknown',
    secondaryIntents: [],
    confidence: 0.35,
    entities: {
      requestedProductTypes: [],
      needs: [],
      exclusions: [],
      orderReference: null,
      productReferences: [],
      recommendationDomain: null,
    },
    missingFields: [],
    requiresIdentity: false,
    requiresHumanReview: false,
    ...overrides,
  };
}

function candidate(
  overrides: Partial<AiArmanModelInterpretationCandidate> = {},
): AiArmanModelInterpretationCandidate {
  return {
    schemaVersion: 'ai-arman-interpretation-v1',
    source: 'model_candidate',
    locale: 'sv-SE',
    primaryIntent: 'tracking_status',
    secondaryIntents: [],
    confidence: 0.96,
    entities: {
      requestedProductTypes: [],
      needs: [],
      exclusions: [],
      orderReference: null,
      productReferences: [],
      recommendationDomain: null,
    },
    missingFields: ['verifiedOrderIdentity'],
    requiresIdentity: true,
    requiresHumanReview: false,
    ...overrides,
  };
}

function service() {
  return new ChatInterpretationPromotionService(
    new ChatInterpretationValidator(),
  );
}

describe('ChatInterpretationPromotionService', () => {
  beforeEach(() => {
    process.env.AI_ARMAN_MODEL_PROMOTION_ENABLED = 'true';
    delete process.env.AI_ARMAN_MODEL_PROMOTION_MIN_CONFIDENCE;
  });

  afterAll(() => {
    restore('AI_ARMAN_MODEL_PROMOTION_ENABLED', ORIGINAL_ENABLED);
    restore('AI_ARMAN_MODEL_PROMOTION_MIN_CONFIDENCE', ORIGINAL_CONFIDENCE);
  });

  it('keeps deterministic interpretation when promotion is disabled', () => {
    delete process.env.AI_ARMAN_MODEL_PROMOTION_ENABLED;

    expect(service().evaluate(deterministic(), candidate())).toEqual({
      status: 'keep_deterministic',
      proposal: null,
      reasons: ['model_promotion_disabled'],
    });
  });

  it('promotes a high-confidence semantic intent from deterministic unknown', () => {
    expect(service().evaluate(deterministic(), candidate())).toMatchObject({
      status: 'promote',
      proposal: {
        primaryIntent: 'tracking_status',
        confidence: 0.96,
      },
    });
  });

  it('never allows the model to introduce or change an order reference', () => {
    const withOrder = candidate({
      entities: {
        ...candidate().entities,
        orderReference: '90250',
      },
    });

    expect(service().evaluate(deterministic(), withOrder)).toEqual({
      status: 'keep_deterministic',
      proposal: null,
      reasons: ['model_cannot_change_order_reference'],
    });
  });

  it('does not let a conflicting model intent override a known deterministic intent', () => {
    const known = deterministic({
      primaryIntent: 'return_help',
      requiresIdentity: true,
    });

    expect(service().evaluate(known, candidate())).toEqual({
      status: 'keep_deterministic',
      proposal: null,
      reasons: ['model_cannot_override_known_deterministic_intent'],
    });
  });

  it('can enrich the same product recommendation with a validated product type and domain', () => {
    const known = deterministic({
      primaryIntent: 'product_recommendation',
      entities: {
        ...deterministic().entities,
        needs: ['dry_lengths'],
        recommendationDomain: 'haircare',
      },
    });
    const model = candidate({
      primaryIntent: 'product_recommendation',
      requiresIdentity: false,
      missingFields: [],
      entities: {
        ...candidate().entities,
        requestedProductTypes: ['shampoo'],
        recommendationDomain: 'haircare',
      },
    });

    expect(service().evaluate(known, model)).toMatchObject({
      status: 'promote',
      proposal: {
        primaryIntent: 'product_recommendation',
        requestedProductTypes: ['shampoo'],
        recommendationDomain: 'haircare',
      },
    });
  });

  it('rejects candidates below the confidence threshold', () => {
    process.env.AI_ARMAN_MODEL_PROMOTION_MIN_CONFIDENCE = '0.9';

    expect(
      service().evaluate(deterministic(), candidate({ confidence: 0.89 })),
    ).toEqual({
      status: 'keep_deterministic',
      proposal: null,
      reasons: ['model_candidate_below_confidence_gate'],
    });
  });

  it('derives identity requirements from the intent instead of trusting the model flag', () => {
    expect(
      service().evaluate(
        deterministic(),
        candidate({ requiresIdentity: false }),
      ),
    ).toEqual({
      status: 'keep_deterministic',
      proposal: null,
      reasons: ['model_identity_requirement_mismatch'],
    });
  });

  it('rejects inconsistent product type and beauty domain combinations', () => {
    const model = candidate({
      primaryIntent: 'product_recommendation',
      requiresIdentity: false,
      entities: {
        ...candidate().entities,
        requestedProductTypes: ['shampoo'],
        recommendationDomain: 'skincare',
      },
    });

    expect(service().evaluate(deterministic(), model)).toEqual({
      status: 'keep_deterministic',
      proposal: null,
      reasons: ['model_product_domain_inconsistent'],
    });
  });

  it('rejects malformed candidates through the existing strict validator', () => {
    expect(service().evaluate(deterministic(), { hello: 'world' })).toEqual({
      status: 'keep_deterministic',
      proposal: null,
      reasons: ['model_candidate_invalid'],
    });
  });
});

function restore(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
