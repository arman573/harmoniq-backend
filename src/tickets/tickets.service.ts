import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateMessageDto } from './create-message.dto';
import { CreateTicketDto } from './create-ticket.dto';
import { Message } from './message.entity';
import { Ticket } from './ticket.entity';
import { UpdateTicketDto } from './update-ticket.dto';
import { UpdateTicketStatusDto } from './update-ticket-status.dto';
import { User, UserRole } from '../users/user.entity';
import { Customer } from '../customers/customer.entity';
import { CustomerEvent } from '../intelligence/customer-event.entity';
import { CustomerFact } from '../intelligence/customer-fact.entity';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(CustomerEvent)
    private readonly eventRepository: Repository<CustomerEvent>,
    @InjectRepository(CustomerFact)
    private readonly factRepository: Repository<CustomerFact>,
  ) {}

  async createTicket(data: CreateTicketDto) {
    let customer = await this.customerRepository.findOne({
      where: { email: data.customerEmail },
    });

    if (!customer) {
      customer = this.customerRepository.create({ email: data.customerEmail });
      await this.customerRepository.save(customer);
    }

    const ticket = this.ticketRepository.create({
      ...data,
      customer,
    });

    const saved = await this.ticketRepository.save(ticket);

    await this.eventRepository.save(
      this.eventRepository.create({
        type: 'ticket_created',
        payload: { ticketId: saved.id },
        customer,
      }),
    );

    return saved;
  }

  getTickets() {
    return this.ticketRepository.find({
      relations: { messages: true, customer: true },
      order: { createdAt: 'DESC' },
    });
  }

  async getTicket(id: number) {
    const ticket = await this.ticketRepository.findOne({
      where: { id },
      relations: { messages: true, customer: true },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    return ticket;
  }

  async updateTicket(id: number, data: UpdateTicketDto) {
    const ticket = await this.findTicketOrThrow(id);
    Object.assign(ticket, data);

    return this.ticketRepository.save(ticket);
  }

  async addMessage(id: number, data: CreateMessageDto, user: User) {
    const ticket = await this.findTicketOrThrow(id);

    const message = this.messageRepository.create({
      content: data.content,
      ticket,
      sender: user.role === UserRole.ADMIN ? 'admin' : 'customer',
    });

    const saved = await this.messageRepository.save(message);

    if (ticket.customer) {
      await this.eventRepository.save(
        this.eventRepository.create({
          type: 'message',
          payload: { content: data.content },
          customer: ticket.customer,
        }),
      );

      if (data.content.toLowerCase().includes('känslig hud')) {
        await this.factRepository.save(
          this.factRepository.create({
            type: 'skin_type',
            value: 'sensitive',
            customer: ticket.customer,
          }),
        );
      }
    }

    return saved;
  }

  async updateTicketStatus(id: number, data: UpdateTicketStatusDto) {
    const ticket = await this.findTicketOrThrow(id);
    ticket.status = data.status;

    return this.ticketRepository.save(ticket);
  }

  async deleteTicket(id: number) {
    const result = await this.ticketRepository.delete(id);

    if (!result.affected) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    return { deleted: true, id };
  }

  private async findTicketOrThrow(id: number) {
    const ticket = await this.ticketRepository.findOne({
      where: { id },
      relations: { customer: true },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    return ticket;
  }
}
