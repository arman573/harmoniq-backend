import { BadRequestException } from '@nestjs/common';
import { ChatInterpretationValidator } from './chat-interpretation.validator';

describe('ChatInterpretationValidator', () => {
  const validator = new ChatInterpretationValidator();

  function validCandidate() {
    return {
      schemaVersion: 'ai-arman-interpretation-v1',
      source: 'model_candidate',
      locale: 'sv-SE',
      primaryIntent: 'product_recommendation',
      secondaryIntents: [],
      confidence: 0.84,
      entities: {
        requestedProductTypes: ['shampoo'],
        needs: ['color_treated_hair', 'dry_lengths'],
        exclusions: [],
        orderReference: null,
        productReferences: [],
      },
      missingFields: [],
      requiresIdentity: false,
      requiresHumanReview: false,
    };
  }

  it('accepts a complete model candidate with exact schema', () => {
    expect(validator.parse(validCandidate())).toEqual(validCandidate());
  });

  it('rejects unknown top-level fields', () => {
    expect(() =>
      validator.parse({ ...validCandidate(), plannedTools: ['get_order'] }),
    ).toThrow(BadRequestException);
  });

  it('rejects unsupported intent values', () => {
    expect(() =>
      validator.parse({ ...validCandidate(), primaryIntent: 'refund_order' }),
    ).toThrow('interpretation_invalid:primaryIntent');
  });

  it('rejects unsupported product types', () => {
    const candidate = validCandidate();
    candidate.entities.requestedProductTypes = ['hair_oil'];

    expect(() => validator.parse(candidate)).toThrow(
      'interpretation_invalid:entities.requestedProductTypes.0',
    );
  });

  it('rejects oversized arrays', () => {
    const candidate = validCandidate();
    candidate.entities.needs = Array.from({ length: 21 }, (_, index) =>
      `need-${index}`,
    );

    expect(() => validator.parse(candidate)).toThrow(
      'interpretation_invalid:entities.needs',
    );
  });
});
