import { BadRequestException } from '@nestjs/common';
import { RecommendationScoringService } from '../recommendation/recommendation-scoring.service';
import { ChatPreviewService } from './chat-preview.service';
import { ChatPreviewCandidate } from './chat-preview.types';

function candidate(
  productId: string,
  title: string,
  designation: number,
  inciSuitability: number,
  price?: number,
): ChatPreviewCandidate {
  return {
    productId,
    title,
    scores: {
      designation,
      inciSuitability,
      category: 85,
      tags: 75,
    },
    personalizationScore: 20,
    evidence: {
      designationReasons: ['rätt produkttyp'],
      inciSignals: ['fuktbindare'],
      categoryReasons: ['rätt kategori'],
      tagReasons: ['färgat hår'],
      limitations: ['innehåller parfym'],
      confidence: 90,
      engineVersion: 'test-v1',
    },
    specialFit: ['torrt hår'],
    usage: ['Massera i hårbotten och skölj.'],
    commercialFacts:
      price === undefined
        ? undefined
        : {
            price,
            currency: 'SEK',
            stockStatus: 'unknown',
            source: 'preview',
          },
  };
}

describe('ChatPreviewService', () => {
  const service = new ChatPreviewService(new RecommendationScoringService());

  it('returns customer-facing cards and keeps production actions disabled', () => {
    const result = service.compose({
      message: 'Jag behöver schampo för torrt färgat hår',
      candidates: [
        candidate('best', 'Bästa schampot', 95, 92, 349),
        candidate('budget', 'Budgetschampot', 87, 84, 199),
        candidate('special', 'Parfymfritt alternativ', 82, 80, 299),
      ],
    });

    expect(result.mode).toBe('chat-preview');
    expect(result.safety.productionActionsEnabled).toBe(false);
    expect(result.recommendations).toHaveLength(3);
    expect(result.recommendations[0].label).toBe('Bäst matchning');
    expect(result.recommendations[1].label).toBe('Bästa prisvärda alternativ');
    expect(result.recommendations[0].inciSignals).toContain('fuktbindare');
  });

  it('does not recommend a candidate that fails the INCI gate', () => {
    const result = service.compose({
      message: 'Jag vill ha ett milt schampo',
      candidates: [candidate('rejected', 'Fel formulering', 95, 40)],
    });

    expect(result.recommendations).toHaveLength(0);
    expect(result.rejected[0].reasons).toContain('inci_gate_failed');
    expect(result.assistant.message).toContain('ingen produkt');
  });

  it('rejects an empty customer message', () => {
    expect(() =>
      service.compose({
        message: '',
        candidates: [candidate('one', 'Produkt', 90, 90)],
      }),
    ).toThrow(BadRequestException);
  });
});
