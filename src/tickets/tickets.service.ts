import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateMessageDto } from './create-message.dto';
import { CreateTicketDto } from './create-ticket.dto';
import { Message } from './message.entity';
import { Ticket } from './ticket.entity';
import { UpdateTicketDto } from './update-ticket.dto';
import { UpdateTicketStatusDto } from './update-ticket-status.dto';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  createTicket(data: CreateTicketDto) {
    const ticket = this.ticketRepository.create(data);

    return this.ticketRepository.save(ticket);
  }

  getTickets() {
    return this.ticketRepository.find({
      relations: { messages: true },
      order: { createdAt: 'DESC' },
    });
  }

  async getTicket(id: number) {
    const ticket = await this.ticketRepository.findOne({
      where: { id },
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

  async addMessage(id: number, data: CreateMessageDto) {
    const ticket = await this.findTicketOrThrow(id);
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
