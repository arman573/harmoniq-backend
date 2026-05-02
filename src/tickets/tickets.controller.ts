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
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../users/user.entity';
import { CreateMessageDto } from './create-message.dto';
import { CreateTicketDto } from './create-ticket.dto';
import { TicketsService } from './tickets.service';
import { UpdateTicketDto } from './update-ticket.dto';
import { UpdateTicketStatusDto } from './update-ticket-status.dto';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  createTicket(@Body() body: CreateTicketDto) {
    return this.ticketsService.createTicket(body);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  getTickets() {
    return this.ticketsService.getTickets();
  }

  @Get(':id')
  getTicket(@Param('id', ParseIntPipe) id: number) {
    return this.ticketsService.getTicket(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
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
  @Roles(UserRole.ADMIN)
  updateTicketStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateTicketStatusDto,
  ) {
    return this.ticketsService.updateTicketStatus(id, body);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  deleteTicket(@Param('id', ParseIntPipe) id: number) {
    return this.ticketsService.deleteTicket(id);
  }
}
