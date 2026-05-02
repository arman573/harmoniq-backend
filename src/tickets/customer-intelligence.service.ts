import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './customer.entity';
import { CustomerEvent } from './customer-event.entity';
import { CustomerFact } from './customer-fact.entity';

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
    const facts: CustomerFactInput[] = [];

    if (text.includes('känslig hud') || text.includes('sensitive skin')) {
      facts.push({
        customer,
        type: 'skin_concern',
        value: 'sensitive_skin',
        source: 'message_rule',
        confidence: 0.75,
      });
    }

    if (text.includes('parfymfri') || text.includes('utan parfym')) {
      facts.push({
        customer,
        type: 'preference',
        value: 'fragrance_free',
        source: 'message_rule',
        confidence: 0.8,
      });
    }

    if (text.includes('torr hud') || text.includes('dry skin')) {
      facts.push({
        customer,
        type: 'skin_concern',
        value: 'dry_skin',
        source: 'message_rule',
        confidence: 0.7,
      });
    }

    if (text.includes('akne') || text.includes('acne')) {
      facts.push({
        customer,
        type: 'skin_concern',
        value: 'acne',
        source: 'message_rule',
        confidence: 0.7,
      });
    }

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
