import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { CreateMessageDto } from './create-message.dto';
import { CreateTicketDto } from './create-ticket.dto';
import { Message, MessageChannel, MessageType } from './message.entity';
import { Ticket } from './ticket.entity';
import { UpdateTicketDto } from './update-ticket.dto';
import { UpdateTicketStatusDto } from './update-ticket-status.dto';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user.entity';
import { Customer } from './customer.entity';
import { CustomerFact } from './customer-fact.entity';
import { CustomerEvent } from './customer-event.entity';
import { CustomerIntelligenceService } from './customer-intelligence.service';
import { TaxonomyTag } from '../taxonomy/taxonomy-tag.entity';
import { Product } from '../products/product.entity';
import { ProductAnalysis } from '../products/product-analysis.entity';
import { ExplainabilityService } from '../explainability/explainability.service';
import { IngredientIntelligenceResult } from '../ingredients/ingredients.service';
import { buildRecommendationEvidence } from './recommendation-evidence';
import { calculateRecommendationScoreV5 } from './recommendation-scoring';
import {
  buildBeautyProfileSummary,
  buildUnifiedBeautyProfile,
} from './unified-beauty-profile';

type RecommendationWarning = {
  code: string;
  fact: string;
  penalty: number;
  message: string;
};

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(CustomerFact)
    private readonly factRepository: Repository<CustomerFact>,
    @InjectRepository(CustomerEvent)
    private readonly eventRepository: Repository<CustomerEvent>,
    @InjectRepository(TaxonomyTag)
    private readonly taxonomyTagRepository: Repository<TaxonomyTag>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly intelligenceService: CustomerIntelligenceService,
    private readonly explainabilityService: ExplainabilityService,
  ) {}

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private async findOrCreateCustomer(email: string) {
    const normalized = this.normalizeEmail(email);

    let customer = await this.customerRepository.findOne({
      where: { email: normalized },
    });

    if (!customer) {
      customer = this.customerRepository.create({ email: normalized });
      customer = await this.customerRepository.save(customer);
    }

    return customer;
  }

  private assertTicketAccess(ticket: Ticket, user: User) {
    if (user.role === UserRole.ADMIN) return;

    if (!ticket.owner || ticket.owner.id !== user.id) {
      throw new ForbiddenException();
    }
  }

  private parseNumber(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }

    return null;
  }

  private getNumberFromAnalysis(analysis: ProductAnalysis, key: string) {
    const normalizedScore = this.parseNumber(analysis.scores?.[key]);
    if (normalizedScore !== null) return normalizedScore;

    const rawAnalysis = analysis.rawAnalysis;
    if (!rawAnalysis) return null;

    const rawScores = rawAnalysis.scores;
    const rawNestedValue =
      rawScores && typeof rawScores === 'object' && !Array.isArray(rawScores)
        ? (rawScores as Record<string, unknown>)[key]
        : undefined;

    const rawNestedScore = this.parseNumber(rawNestedValue);
    if (rawNestedScore !== null) return rawNestedScore;

    return this.parseNumber(rawAnalysis[key]);
  }

  private normalizeAnalysisScore(score: number) {
    if (score <= 1) return Math.max(0, Math.min(1, score));
    return Math.max(0, Math.min(100, score)) / 100;
  }

  private getBestAnalysisScore(product: Product, key: string) {
    const scores = (product.analyses || [])
      .map((analysis) => this.getNumberFromAnalysis(analysis, key))
      .filter((score): score is number => score !== null);

    if (!scores.length) return null;

    return Math.max(...scores);
  }

  private addAnalysisScore(
    product: Product,
    factValues: Set<string>,
    factValue: string,
    scoreKey: string,
    maxBoost: number,
    reasons: string[],
  ) {
    if (!factValues.has(factValue)) return 0;

    const analysisScore = this.getBestAnalysisScore(product, scoreKey);
    if (analysisScore === null) return 0;

    const normalizedScore = this.normalizeAnalysisScore(analysisScore);
    if (normalizedScore <= 0) return 0;

    const boost = Math.round(maxBoost * normalizedScore);
    if (boost <= 0) return 0;

    const displayScore =
      analysisScore <= 1 ? Math.round(analysisScore * 100) : analysisScore;

    reasons.push(
      `ProductAnalysis ${scoreKey} ${displayScore}/100 for ${factValue} (+${boost})`,
    );

    return boost;
  }

  private normalizeConcept(value: unknown) {
    if (typeof value !== 'string') return null;
    return value.trim().toLowerCase();
  }

  private getConceptsFromValue(value: unknown) {
    if (!Array.isArray(value)) return [];

    return value
      .flatMap((item) => {
        if (typeof item === 'string') return [item];
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const record = item as Record<string, unknown>;
          return [record.code, record.key, record.normalizedKey, record.value];
        }
        return [];
      })
      .map((item) => this.normalizeConcept(item))
      .filter((item): item is string => Boolean(item));
  }

  private getProductAnalysisConcepts(product: Product) {
    const concepts = new Set<string>();

    for (const analysis of product.analyses || []) {
      for (const concept of this.getConceptsFromValue(analysis.warnings)) {
        concepts.add(concept);
      }

      for (const concept of this.getConceptsFromValue(
        analysis.matchedConcepts,
      )) {
        concepts.add(concept);
      }

      for (const concept of this.getConceptsFromValue(
        analysis.notSuitableFor,
      )) {
        concepts.add(concept);
      }

      const rawAnalysis = analysis.rawAnalysis;
      if (!rawAnalysis) continue;

      for (const key of ['warnings', 'matchedConcepts', 'notSuitableFor']) {
        for (const concept of this.getConceptsFromValue(rawAnalysis[key])) {
          concepts.add(concept);
        }
      }

      for (const key of [
        'contains_fragrance',
        'containsFragrance',
        'irritants',
        'contains_irritants',
        'containsIrritants',
        'comedogenicRisk',
        'comedogenic_risk',
      ]) {
        if (rawAnalysis[key] === true) concepts.add(this.camelToSnake(key));
      }
    }

    return concepts;
  }

  private camelToSnake(value: string) {
    return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }

  private productHasAnalysisConcept(
    productConcepts: Set<string>,
    concept: string,
  ) {
    return productConcepts.has(concept);
  }

  private addWarningPenalty(
    productConcepts: Set<string>,
    factValues: Set<string>,
    triggerFacts: string[],
    warningConcepts: string[],
    penalty: number,
    message: string,
    warnings: RecommendationWarning[],
  ) {
    const matchedFact = triggerFacts.find((fact) => factValues.has(fact));
    if (!matchedFact) return 0;

    const matchedWarning = warningConcepts.find((concept) =>
      this.productHasAnalysisConcept(productConcepts, concept),
    );
    if (!matchedWarning) return 0;

    warnings.push({
      code: matchedWarning,
      fact: matchedFact,
      penalty,
      message,
    });

    return penalty;
  }

  private getLatestProductAnalysis(product: Product) {
    const analyses = product.analyses || [];

    if (!analyses.length) return undefined;

    return [...analyses].sort((a, b) => {
      const createdDiff =
        this.getTimestamp(b.createdAt) - this.getTimestamp(a.createdAt);
      if (createdDiff) return createdDiff;

      return (b.id ?? 0) - (a.id ?? 0);
    })[0];
  }

  private getTimestamp(value: Date | undefined) {
    return value instanceof Date ? value.getTime() : 0;
  }

  private getIngredientIntelligence(
    analysis: ProductAnalysis | undefined,
  ): IngredientIntelligenceResult | undefined {
    const value = analysis?.rawAnalysis?.ingredientIntelligence;

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }

    return value as IngredientIntelligenceResult;
  }

  getCustomers() {
    return this.customerRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getCustomer(id: number) {
    const customer = await this.customerRepository.findOne({
      where: { id },
      relations: { tickets: true },
    });

    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }

    return customer;
  }

  async getCustomerProfile(id: number) {
    const customer = await this.customerRepository.findOne({ where: { id } });

    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }

    const facts = await this.factRepository.find({
      where: { customer: { id } },
      order: { createdAt: 'DESC' },
    });

    const recentEvents = await this.eventRepository.find({
      where: { customer: { id } },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    const taxonomyTags = await this.taxonomyTagRepository.find();

    const matchedTaxonomy = facts
      .map((fact) => {
        const match = taxonomyTags.find(
          (tag) => tag.normalizedKey === fact.value,
        );

        if (!match) return null;

        return {
          factType: fact.type,
          factValue: fact.value,
          taxonomyName: match.name,
          normalizedKey: match.normalizedKey,
          domain: match.domain,
          kind: match.kind,
        };
      })
      .filter(Boolean);

    const summary = facts.reduce<Record<string, string[]>>((acc, fact) => {
      if (!acc[fact.type]) acc[fact.type] = [];
      if (!acc[fact.type].includes(fact.value)) acc[fact.type].push(fact.value);
      return acc;
    }, {});
    const unifiedBeautyProfile = buildUnifiedBeautyProfile(id, facts);

    return {
      customer,
      summary,
      facts,
      recentEvents,
      matchedTaxonomy,
      unifiedBeautyProfile,
    };
  }

  async getCustomerRecommendations(id: number) {
    const customer = await this.customerRepository.findOne({ where: { id } });
    if (!customer) throw new NotFoundException(`Customer ${id} not found`);

    const facts = await this.factRepository.find({
      where: { customer: { id } },
    });
    const unifiedBeautyProfile = buildUnifiedBeautyProfile(id, facts);
    const beautyProfileSummary =
      buildBeautyProfileSummary(unifiedBeautyProfile);
    const factValues = new Set(facts.map((f) => f.value));

    const products = await this.productRepository.find({
      where: {
        quantity: MoreThan(0),
        isActive: true,
        isDiscontinued: false,
      },
      relations: { tags: true, analyses: true },
    });

    const recommendations = products
      .map((product) => {
        let score = 0;
        const reasons: string[] = [];
        const warnings: RecommendationWarning[] = [];
        const matched = new Set<string>();

        for (const tag of product.tags || []) {
          if (!tag.normalizedKey) continue;

          if (
            factValues.has(tag.normalizedKey) &&
            !matched.has(tag.normalizedKey)
          ) {
            matched.add(tag.normalizedKey);

            if (tag.normalizedKey === 'price_sensitive') {
              score += 10;
            } else {
              score += 25;
            }

            reasons.push(`Matched customer fact ${tag.normalizedKey}`);
          }
        }

        score += this.addAnalysisScore(
          product,
          factValues,
          'dry_skin',
          'hydrationScore',
          20,
          reasons,
        );
        score += this.addAnalysisScore(
          product,
          factValues,
          'acne_prone',
          'acneSafetyScore',
          15,
          reasons,
        );
        score += this.addAnalysisScore(
          product,
          factValues,
          'sensitive_skin',
          'sensitiveSafetyScore',
          15,
          reasons,
        );

        const productConcepts = this.getProductAnalysisConcepts(product);

        score += this.addWarningPenalty(
          productConcepts,
          factValues,
          ['fragrance_sensitive', 'fragrance_free'],
          ['contains_fragrance'],
          -60,
          'Customer prefers fragrance-free products, but ProductAnalysis indicates fragrance.',
          warnings,
        );
        score += this.addWarningPenalty(
          productConcepts,
          factValues,
          ['sensitive_skin'],
          ['irritants', 'contains_irritants'],
          -40,
          'Customer has sensitive skin, but ProductAnalysis indicates potential irritants.',
          warnings,
        );
        score += this.addWarningPenalty(
          productConcepts,
          factValues,
          ['acne_prone'],
          ['comedogenic_risk'],
          -35,
          'Customer is acne-prone, but ProductAnalysis indicates comedogenic risk.',
          warnings,
        );

        const latestAnalysis = this.getLatestProductAnalysis(product);
        const ingredientIntelligence =
          this.getIngredientIntelligence(latestAnalysis);
        const recommendationV5 = calculateRecommendationScoreV5({
          customerFacts: facts,
          unifiedBeautyProfile,
          productTags: product.tags,
          productAnalysis: latestAnalysis,
          ingredientIntelligence,
        });
        const evidence = buildRecommendationEvidence({
          customerFacts: facts,
          productTags: product.tags,
          productAnalysis: latestAnalysis,
          ingredientIntelligence,
          scoreBreakdown: recommendationV5.scoreBreakdown,
        });
        const explanation =
          this.explainabilityService.generateProductExplanation({
            customerFacts: facts,
            productTags: product.tags,
            productAnalysis: latestAnalysis,
            ingredientIntelligence,
            scoreBreakdown: recommendationV5.scoreBreakdown,
            confidence: evidence.confidence,
            confidenceLevel: evidence.level,
            evidence,
          });

        return {
          product,
          score,
          reasons,
          warnings,
          explanation,
          confidence: evidence.confidence,
          confidenceLevel: evidence.level,
          evidence,
          recommendationScoreV5: recommendationV5.recommendationScoreV5,
          domains: recommendationV5.domains,
          profileAlignment: recommendationV5.profileAlignment,
          scoreBreakdown: recommendationV5.scoreBreakdown,
          blocked: recommendationV5.blocked,
          blockers: recommendationV5.blockers,
        };
      })
      .filter(
        (r) =>
          r.score > 0 ||
          r.warnings.length > 0 ||
          r.recommendationScoreV5 !== 0 ||
          r.blocked,
      )
      .sort((a, b) => {
        if (a.blocked !== b.blocked)
          return Number(a.blocked) - Number(b.blocked);
        if (b.recommendationScoreV5 !== a.recommendationScoreV5) {
          return b.recommendationScoreV5 - a.recommendationScoreV5;
        }

        return b.score - a.score;
      });

    return {
      customerId: id,
      facts,
      beautyProfileSummary,
      recommendations,
    };
  }

  async createTicket(data: CreateTicketDto, user: User) {
    const customer = await this.findOrCreateCustomer(data.customerEmail);

    const ticket = this.ticketRepository.create({
      ...data,
      owner: user,
      customer,
    });

    const saved = await this.ticketRepository.save(ticket);

    await this.intelligenceService.createEvent({
      customer,
      type: 'ticket_created',
      payload: { ticketId: saved.id },
    });

    await this.messageRepository.save(
      this.messageRepository.create({
        ticket: saved,
        author: user,
        sender: user.role,
        type: MessageType.SYSTEM,
        channel: MessageChannel.SYSTEM,
        content: 'Ticket created',
      }),
    );

    return saved;
  }

  async updateTicket(id: number, data: UpdateTicketDto) {
    const ticket = await this.findTicketOrThrow(id);
    Object.assign(ticket, data);

    return this.ticketRepository.save(ticket);
  }

  async addMessage(id: number, data: CreateMessageDto, user: User) {
    const ticket = await this.ticketRepository.findOne({
      where: { id },
      relations: { owner: true, customer: true },
    });

    if (!ticket) throw new NotFoundException();
    this.assertTicketAccess(ticket, user);

    const message = this.messageRepository.create({
      content: data.content,
      ticket,
      author: user,
      sender: user.role,
      channel: MessageChannel.CHAT,
      type: MessageType.MESSAGE,
    });

    const saved = await this.messageRepository.save(message);

    if (ticket.customer) {
      await this.intelligenceService.createEvent({
        customer: ticket.customer,
        type: 'message_sent',
        payload: { ticketId: ticket.id, messageId: saved.id },
      });

      await this.intelligenceService.extractFactsFromMessage(
        ticket.customer,
        data.content,
      );
    }

    return saved;
  }

  async updateTicketStatus(
    id: number,
    data: UpdateTicketStatusDto,
    user: User,
  ) {
    const ticket = await this.findTicketOrThrow(id);

    const oldStatus = ticket.status;
    ticket.status = data.status;

    const updated = await this.ticketRepository.save(ticket);

    if (ticket.customer) {
      await this.intelligenceService.createEvent({
        customer: ticket.customer,
        type: 'status_changed',
        payload: { from: oldStatus, to: data.status },
      });
    }

    await this.messageRepository.save(
      this.messageRepository.create({
        ticket: updated,
        author: user,
        sender: user.role,
        type: MessageType.SYSTEM,
        channel: MessageChannel.SYSTEM,
        content: `Status changed from ${oldStatus} to ${data.status}`,
      }),
    );

    return updated;
  }

  getTickets(user: User) {
    const base = {
      relations: { messages: true },
      order: {
        createdAt: 'DESC' as const,
        messages: { createdAt: 'ASC' as const },
      },
    };

    if (user.role === UserRole.ADMIN) {
      return this.ticketRepository.find(base);
    }

    return this.ticketRepository.find({
      ...base,
      where: { owner: { id: user.id } },
    });
  }

  async getTicket(id: number, user: User) {
    const ticket = await this.ticketRepository.findOne({
      where: { id },
      relations: { messages: true, owner: true },
      order: { messages: { createdAt: 'ASC' } },
    });

    if (!ticket) throw new NotFoundException();
    this.assertTicketAccess(ticket, user);

    return ticket;
  }

  async deleteTicket(id: number) {
    const result = await this.ticketRepository.delete(id);

    if (!result.affected) throw new NotFoundException();

    return { deleted: true, id };
  }

  private async findTicketOrThrow(id: number) {
    const ticket = await this.ticketRepository.findOne({
      where: { id },
      relations: { customer: true },
    });

    if (!ticket) throw new NotFoundException();
    return ticket;
  }
}
