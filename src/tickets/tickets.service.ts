import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    private readonly intelligenceService: CustomerIntelligenceService,
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

    const summary = facts.reduce<Record<string, string[]>>((acc, fact) => {
      if (!acc[fact.type]) acc[fact.type] = [];
      if (!acc[fact.type].includes(fact.value)) acc[fact.type].push(fact.value);
      return acc;
    }, {});

    return { customer, summary, facts, recentEvents };
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

  async updateTicketStatus(id: number, data: UpdateTicketStatusDto, user: User) {
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
