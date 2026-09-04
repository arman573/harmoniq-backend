import { ChatInterpretationShadowService } from './chat-interpretation-shadow.service';
import { ChatInterpretationValidator } from './chat-interpretation.validator';
import type { AiArmanInterpretation } from './chat-messages.types';

describe('ChatInterpretationShadowService', () => {
  const service = new ChatInterpretationShadowService(
    new ChatInterpretationValidator(),
  );

  const deterministic: AiArmanInterpretation = {
    schemaVersion: 'ai-arman-interpretation-v1',
    source: 'deterministic_fallback',
    locale: 'sv-SE',
    primaryIntent: 'product_recommendation',
    secondaryIntents: [],
    confidence: 0.72,
    entities: {
      requestedProductTypes: ['shampoo'],
      needs: ['thin_hair', 'color_treated_hair'],
      exclusions: ['fragrance'],
      orderReference: null,
      productReferences: [],
    },
    missingFields: [],
    requiresIdentity: false,
    requiresHumanReview: false,
  };

  it('compares a valid candidate without granting any authority', () => {
    const result = service.compare(deterministic, {
      ...deterministic,
      source: 'model_candidate',
      confidence: 0.8,
      entities: {
        ...deterministic.entities,
        needs: ['thin_hair'],
      },
    });

    expect(result.status).toBe('valid_candidate');
    expect(result.primaryIntentMatch).toBe(true);
    expect(result.requestedProductTypeOverlap).toBe(1);
    expect(result.needOverlap).toBe(0.5);
    expect(result.confidenceDelta).toBe(0.08);
    expect(result.affectsCustomerResponse).toBe(false);
    expect(result.affectsState).toBe(false);
    expect(result.affectsTools).toBe(false);
  });

  it('fails closed when the candidate does not pass validation', () => {
    const result = service.compare(deterministic, {
      primaryIntent: 'refund_order',
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: 'invalid_candidate',
        candidateSource: null,
        primaryIntentMatch: null,
        affectsCustomerResponse: false,
        affectsState: false,
        affectsTools: false,
      }),
    );
  });

  it('does not mask unexpected validator failures as invalid model output', () => {
    const validator = {
      parse: jest.fn(() => {
        throw new Error('validator exploded');
      }),
    } as unknown as ChatInterpretationValidator;
    const unexpectedFailureService = new ChatInterpretationShadowService(
      validator,
    );

    expect(() =>
      unexpectedFailureService.compare(deterministic, {}),
    ).toThrow('validator exploded');
  });

  it('reports complete overlap for two empty entity lists', () => {
    const result = service.compare(deterministic, {
      ...deterministic,
      source: 'model_candidate',
    });

    expect(result.secondaryIntentOverlap).toBe(1);
  });
});
