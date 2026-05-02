import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './customer.entity';
import { CustomerFact } from '../intelligence/customer-fact.entity';
import { CustomerEvent } from '../intelligence/customer-event.entity';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(CustomerFact)
    private readonly factRepository: Repository<CustomerFact>,
    @InjectRepository(CustomerEvent)
    private readonly eventRepository: Repository<CustomerEvent>,
  ) {}

  async getProfile(id: number) {
    const customer = await this.customerRepository.findOne({ where: { id } });

    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }

    const facts = await this.factRepository.find({
      where: { customer: { id } },
      order: { createdAt: 'DESC' },
    });

    const events = await this.eventRepository.find({
      where: { customer: { id } },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    const summary = facts.reduce<Record<string, string[]>>((acc, fact) => {
      if (!acc[fact.type]) {
        acc[fact.type] = [];
      }

      if (!acc[fact.type].includes(fact.value)) {
        acc[fact.type].push(fact.value);
      }

      return acc;
    }, {});

    return {
      customer,
      summary,
      facts,
      recentEvents: events,
    };
  }
}
