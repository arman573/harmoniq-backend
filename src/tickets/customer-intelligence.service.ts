import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../customers/customer.entity';
import { CustomerEvent } from '../intelligence/customer-event.entity';
import { CustomerFact } from '../intelligence/customer-fact.entity';

export interface CustomerEventInput {
  customer: Customer;
  type: string;
  payload?: Record<string, unknown>;
}

export interface CustomerFactInput {
  customer: Customer;
  type: string;
  value: string;
  source: string;
  confidence?: number;
}

interface MessageRule {
  type: string;
  value: string;
  keywords: string[];
  confidence: number;
}

const MESSAGE_RULES: MessageRule[] = [
  {
    type: 'skin_concern',
    value: 'sensitive_skin',
    keywords: ['känslig hud', 'sensitive skin', 'ömtålig hud'],
    confidence: 0.75,
  },
  {
    type: 'preference',
    value: 'fragrance_free',
    keywords: ['parfymfri', 'utan parfym', 'fragrance free', 'parfymfria'],
    confidence: 0.8,
  },
  {
    type: 'skin_concern',
    value: 'dry_skin',
    keywords: ['torr hud', 'dry skin', 'väldigt torr', 'flagnar'],
    confidence: 0.7,
  },
  {
    type: 'skin_concern',
    value: 'acne_prone',
    keywords: ['akne', 'acne', 'finnar', 'utbrott'],
    confidence: 0.7,
  },
  {
    type: 'preference',
    value: 'price_sensitive',
    keywords: ['budget', 'billig', 'prisvärd', 'inte för dyr', 'budgetvänlig'],
    confidence: 0.65,
  },
  {
    type: 'preference',
    value: 'premium_products',
    keywords: ['premium', 'lyx', 'exklusiv', 'bästa produkten', 'dyr men bra'],
    confidence: 0.65,
  },
  {
    type: 'preference',
    value: 'organic',
    keywords: ['ekologisk', 'organic', 'naturlig'],
    confidence: 0.65,
  },
  {
    type: 'preference',
    value: 'vegan',
    keywords: ['vegan', 'vegansk'],
    confidence: 0.65,
  },
];

@Injectable()
export class CustomerIntelligenceService {
  constructor(
    @InjectRepository(CustomerEvent)
    private readonly customerEventRepository: Repository<CustomerEvent>,
    @InjectRepository(CustomerFact)
    private readonly customerFactRepository: Repository<CustomerFact>,
  ) {}

  createEvent(input: CustomerEventInput) {
    return this.customerEventRepository.save(
      this.customerEventRepository.create(input),
    );
  }

  async createFact(input: CustomerFactInput) {
    const confidence = input.confidence ?? 0.6;

    const existing = await this.customerFactRepository.findOne({
      where: {
        customer: { id: input.customer.id },
        type: input.type,
        value: input.value,
        source: input.source,
      },
    });

    if (existing) {
      existing.confidence = Math.max(existing.confidence, confidence);
      return this.customerFactRepository.save(existing);
    }

    return this.customerFactRepository.save(
      this.customerFactRepository.create({ ...input, confidence }),
    );
  }

  async extractFactsFromMessage(customer: Customer, content: string) {
    const text = content.toLowerCase();
    const facts = MESSAGE_RULES.filter((rule) =>
      rule.keywords.some((keyword) => text.includes(keyword)),
    ).map<CustomerFactInput>((rule) => ({
      customer,
      type: rule.type,
      value: rule.value,
      source: 'message_rule',
      confidence: rule.confidence,
    }));

    return Promise.all(facts.map((fact) => this.createFact(fact)));
  }

  mapVendreTagToFact(customer: Customer, tag: string) {
    const normalizedTag = tag.trim().toLowerCase();

    const tagMap: Record<string, Omit<CustomerFactInput, 'customer'>> = {
      parfymfri: {
        type: 'preference',
        value: 'fragrance_free',
        source: 'vendre_tag',
        confidence: 0.85,
      },
      sensitive: {
        type: 'skin_concern',
        value: 'sensitive_skin',
        source: 'vendre_tag',
        confidence: 0.7,
      },
      'känslig hud': {
        type: 'skin_concern',
        value: 'sensitive_skin',
        source: 'vendre_tag',
        confidence: 0.75,
      },
      'torr hud': {
        type: 'skin_concern',
        value: 'dry_skin',
        source: 'vendre_tag',
        confidence: 0.7,
      },
      akne: {
        type: 'skin_concern',
        value: 'acne_prone',
        source: 'vendre_tag',
        confidence: 0.7,
      },
      budget: {
        type: 'preference',
        value: 'price_sensitive',
        source: 'vendre_tag',
        confidence: 0.65,
      },
      premium: {
        type: 'preference',
        value: 'premium_products',
        source: 'vendre_tag',
        confidence: 0.65,
      },
      ekologisk: {
        type: 'preference',
        value: 'organic',
        source: 'vendre_tag',
        confidence: 0.65,
      },
      vegan: {
        type: 'preference',
        value: 'vegan',
        source: 'vendre_tag',
        confidence: 0.65,
      },
    };

    const mapped = tagMap[normalizedTag];

    if (!mapped) {
      return this.createFact({
        customer,
        type: 'vendre_tag',
        value: normalizedTag,
        source: 'vendre_tag',
        confidence: 0.5,
      });
    }

    return this.createFact({ customer, ...mapped });
  }
}
