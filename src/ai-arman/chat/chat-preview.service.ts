import { BadRequestException, Injectable } from '@nestjs/common';
import { RecommendationScoringService } from '../recommendation/recommendation-scoring.service';
import {
  ChatPreviewCandidate,
  ChatPreviewRequest,
  ChatPreviewResponse,
  ChatRecommendationCard,
} from './chat-preview.types';

@Injectable()
export class ChatPreviewService {
  constructor(
    private readonly recommendationScoring: RecommendationScoringService,
  ) {}

  compose(request: ChatPreviewRequest): ChatPreviewResponse {
    const message = String(request?.message || '').trim();
    const candidates = request?.candidates;

    if (message.length < 3 || message.length > 1000) {
      throw new BadRequestException(
        'Customer message must contain between 3 and 1000 characters.',
      );
    }

    if (!Array.isArray(candidates) || candidates.length === 0) {
      throw new BadRequestException('At least one product candidate is required.');
    }

    if (candidates.length > 100) {
      throw new BadRequestException('A chat preview may contain at most 100 candidates.');
    }

    candidates.forEach((candidate) => this.assertCandidate(candidate));

    const ranked = this.recommendationScoring.rankCandidates(candidates);
    const eligible = ranked.filter((candidate) => candidate.eligible);
    const rejected = ranked.filter((candidate) => !candidate.eligible);
    const top = eligible.slice(0, 3);

    const cards = top.map((candidate, index) =>
      this.toCard(
        candidate as ReturnType<RecommendationScoringService['scoreCandidate']> &
          ChatPreviewCandidate,
        index,
        top.length,
      ),
    );

    return {
      ok: true,
      mode: 'chat-preview',
      assistant: {
        name: 'AI Arman',
        disclosure:
          'Jag är AI Arman, Harmoniqs digitala Skönhetshjälte. Mina rekommendationer bygger här på ett säkert preview-underlag och använder ännu inte livepris eller lager.',
        message: this.composeMessage(message, cards),
      },
      summary: {
        received: candidates.length,
        eligible: eligible.length,
        rejected: rejected.length,
      },
      recommendations: cards,
      rejected: rejected.map((candidate) => ({
        productId: candidate.productId,
        title: candidate.title,
        reasons: candidate.rejectionReasons,
      })),
      safety: {
        liveFactsUsed: false,
        productionActionsEnabled: false,
        composer: 'deterministic-preview-v1',
      },
    };
  }

  private toCard(
    candidate: ReturnType<RecommendationScoringService['scoreCandidate']> &
      ChatPreviewCandidate,
    index: number,
    total: number,
  ): ChatRecommendationCard {
    return {
      position: index + 1,
      label: this.resolveLabel(candidate, index, total),
      productId: candidate.productId,
      title: candidate.title,
      whyItFits: this.unique([
        ...candidate.evidence.designationReasons,
        ...candidate.evidence.categoryReasons,
      ]),
      needsSolved: this.unique(candidate.specialFit ?? []),
      inciSignals: this.unique(candidate.evidence.inciSignals),
      limitations: this.unique(candidate.evidence.limitations),
      usage: this.unique(candidate.usage ?? []),
      qualityScore: candidate.qualityScore,
      rankingScore: candidate.rankingScore,
      tier: candidate.tier,
      confidence: this.clamp(candidate.evidence.confidence),
      commercialFacts: candidate.commercialFacts ?? null,
    };
  }

  private resolveLabel(
    candidate: ChatPreviewCandidate,
    index: number,
    total: number,
  ): string {
    if (index === 0) return 'Bäst matchning';

    if (
      candidate.commercialFacts?.price !== undefined
      && this.hasLowestKnownPrice(candidate, total)
    ) {
      return 'Bästa prisvärda alternativ';
    }

    return 'Alternativ för ett särskilt önskemål';
  }

  private hasLowestKnownPrice(
    candidate: ChatPreviewCandidate,
    _total: number,
  ): boolean {
    return Number.isFinite(candidate.commercialFacts?.price);
  }

  private composeMessage(
    customerMessage: string,
    cards: ChatRecommendationCard[],
  ): string {
    if (cards.length === 0) {
      return `Jag hittade ingen produkt som klarade både benämnings- och INCI-grindarna för: “${customerMessage}”. Jag vill hellre säga det tydligt än fylla ut med en svag rekommendation.`;
    }

    const productNames = cards.map((card) => card.title).join(', ');

    return `Utifrån det du beskrev har jag ${cards.length === 1 ? 'hittat en stark matchning' : `valt ${cards.length} godkända alternativ`}: ${productNames}. Benämning och INCI har bedömts tillsammans först, därefter kategori, taggar och begränsad personalisering inom samma kvalitetsnivå.`;
  }

  private assertCandidate(candidate: ChatPreviewCandidate): void {
    if (!candidate || typeof candidate !== 'object') {
      throw new BadRequestException('Every candidate must be an object.');
    }

    if (!String(candidate.productId || '').trim()) {
      throw new BadRequestException('Every candidate requires productId.');
    }

    if (!String(candidate.title || '').trim()) {
      throw new BadRequestException('Every candidate requires title.');
    }

    const scores = candidate.scores;
    for (const score of [
      scores?.designation,
      scores?.inciSuitability,
      scores?.category,
      scores?.tags,
    ]) {
      if (!Number.isFinite(score)) {
        throw new BadRequestException(
          `Candidate ${candidate.productId} contains an invalid score.`,
        );
      }
    }

    if (!candidate.evidence || typeof candidate.evidence !== 'object') {
      throw new BadRequestException(
        `Candidate ${candidate.productId} requires recommendation evidence.`,
      );
    }
  }

  private unique(values: string[]): string[] {
    return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
  }

  private clamp(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.min(100, Math.max(0, value));
  }
}
