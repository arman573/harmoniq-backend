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

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
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

  async createTicket(data: CreateTicketDto, user: User) {
    const customer = await this.findOrCreateCustomer(data.customerEmail);

    const ticket = this.ticketRepository.create({
      ...data,
      owner: user,
      customer,
    });

    const saved = await this.ticketRepository.save(ticket);

    // system message
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

    if (user.role !== UserRole.ADMIN && ticket.owner.id !== user.id) {
      throw new ForbiddenException();
    }

    return ticket;
  }

  async addMessage(id: number, data: CreateMessageDto, user: User) {
    const ticket = await this.ticketRepository.findOne({
      where: { id },
      relations: { owner: true },
    });

    if (!ticket) throw new NotFoundException();

    if (user.role !== UserRole.ADMIN && ticket.owner.id !== user.id) {
      throw new ForbiddenException();
    }

    const message = this.messageRepository.create({
      content: data.content,
      ticket,
      author: user,
      sender: user.role,
      channel: MessageChannel.CHAT,
      type: MessageType.MESSAGE,
    });

    return this.messageRepository.save(message);
  }

  async updateTicketStatus(id: number, data: UpdateTicketStatusDto, user: User) {
    const ticket = await this.findTicketOrThrow(id);

    const oldStatus = ticket.status;
    ticket.status = data.status;

    const updated = await this.ticketRepository.save(ticket);

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

  async deleteTicket(id: number) {
    const result = await this.ticketRepository.delete(id);

    if (!result.affected) throw new NotFoundException();

    return { deleted: true, id };
  }

  private async findTicketOrThrow(id: number) {
    const ticket = await this.ticketRepository.findOneBy({ id });
    if (!ticket) throw new NotFoundException();
    return ticket;
  }
}
