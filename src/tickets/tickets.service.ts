import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateMessageDto } from './create-message.dto';
import { CreateTicketDto } from './create-ticket.dto';
import { Message } from './message.entity';
import { Ticket } from './ticket.entity';
import { UpdateTicketDto } from './update-ticket.dto';
import { UpdateTicketStatusDto } from './update-ticket-status.dto';
import { UserRole } from '../users/user.entity';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  createTicket(data: CreateTicketDto, userId: number) {
    const ticket = this.ticketRepository.create({
      ...data,
      owner: { id: userId } as any,
    });

    return this.ticketRepository.save(ticket);
  }

  getTickets(user: any) {
    if (user.role === UserRole.ADMIN) {
      return this.ticketRepository.find({
        relations: { messages: true },
        order: { createdAt: 'DESC' },
      });
    }

    return this.ticketRepository.find({
      where: { owner: { id: user.sub } as any },
      relations: { messages: true },
      order: { createdAt: 'DESC' },
    });
  }

  async getTicket(id: number, user: any) {
    const where =
      user.role === UserRole.ADMIN
        ? { id }
        : { id, owner: { id: user.sub } as any };

    const ticket = await this.ticketRepository.findOne({
      where,
      relations: { messages: true },
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

  async addMessage(id: number, data: CreateMessageDto, user: any) {
    const ticket = await this.getTicket(id, user);
    const message = this.messageRepository.create({
      ...data,
      ticket,
    });

    return this.messageRepository.save(message);
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
    const ticket = await this.ticketRepository.findOneBy({ id });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    return ticket;
  }
}
