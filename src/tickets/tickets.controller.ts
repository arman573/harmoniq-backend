import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { CreateMessageDto } from './create-message.dto';
import { CreateTicketDto } from './create-ticket.dto';
import { TicketsService } from './tickets.service';
import { UpdateTicketDto } from './update-ticket.dto';
import { UpdateTicketStatusDto } from './update-ticket-status.dto';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  createTicket(@Body() body: CreateTicketDto) {
    return this.ticketsService.createTicket(body);
  }

  @Get()
  getTickets() {
    return this.ticketsService.getTickets();
  }

  @Get(':id')
  getTicket(@Param('id', ParseIntPipe) id: number) {
    return this.ticketsService.getTicket(id);
  }

  @Put(':id')
  updateTicket(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateTicketDto,
  ) {
    return this.ticketsService.updateTicket(id, body);
  }

  @Post(':id/messages')
  addMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateMessageDto,
  ) {
    return this.ticketsService.addMessage(id, body);
  }

  @Patch(':id/status')
  updateTicketStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateTicketStatusDto,
  ) {
    return this.ticketsService.updateTicketStatus(id, body);
  }

  @Delete(':id')
  deleteTicket(@Param('id', ParseIntPipe) id: number) {
    return this.ticketsService.deleteTicket(id);
  }
}
