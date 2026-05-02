import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateMessageDto } from './create-message.dto';
import { CreateTicketDto } from './create-ticket.dto';
import { Message } from './message.entity';
import { Ticket } from './ticket.entity';
import { UpdateTicketDto } from './update-ticket.dto';
import { UpdateTicketStatusDto } from './update-ticket-status.dto';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user.entity';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  createTicket(data: CreateTicketDto, user: User) {
    const ticket = this.ticketRepository.create({
      ...data,
      owner: user,
    });

    return this.ticketRepository.save(ticket);
  }

  getTickets(user: User) {
    if (user.role === UserRole.ADMIN) {
      return this.ticketRepository.find({
        relations: { messages: true },
        order: {
          createdAt: 'DESC',
          messages: { createdAt: 'ASC' },
        },
      });
    }

    return this.ticketRepository.find({
      where: { owner: { id: user.id } },
      relations: { messages: true },
      order: {
        createdAt: 'DESC',
        messages: { createdAt: 'ASC' },
      },
    });
  }

  async getTicket(id: number, user: User) {
    const ticket = await this.ticketRepository.findOne({
      where: { id },
      relations: { messages: true, owner: true },
      order: { messages: { createdAt: 'ASC' } },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    if (user.role !== UserRole.ADMIN && ticket.owner.id !== user.id) {
      throw new ForbiddenException();
    }

    return ticket;
  }

  async updateTicket(id: number, data: UpdateTicketDto) {
    const ticket = await this.findTicketOrThrow(id);
    Object.assign(ticket, data);

    return this.ticketRepository.save(ticket);
  }

  async addMessage(id: number, data: CreateMessageDto, user: User) {
    const ticket = await this.ticketRepository.findOne({
      where: { id },
      relations: { owner: true },
    });

    if (!ticket) {
      throw new NotFoundException();
    }

    if (user.role !== UserRole.ADMIN && ticket.owner.id !== user.id) {
      throw new ForbiddenException();
    }

    const message = this.messageRepository.create({
      content: data.content,
      ticket,
      author: user,
      sender: user.role,
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
