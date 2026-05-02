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
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { User, UserRole } from '../users/user.entity';
import { CreateMessageDto } from './create-message.dto';
import { CreateTicketDto } from './create-ticket.dto';
import { TicketsService } from './tickets.service';
import { UpdateTicketDto } from './update-ticket.dto';
import { UpdateTicketStatusDto } from './update-ticket-status.dto';

type AuthenticatedRequest = Request & {
  user: User;
};

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
    @Req() req: AuthenticatedRequest,
  ) {
    return this.ticketsService.addMessage(id, body, req.user);
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
