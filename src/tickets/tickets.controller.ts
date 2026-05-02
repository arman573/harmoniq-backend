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
  createTicket(@Body() body: CreateTicketDto, @Req() req: any) {
    return this.ticketsService.createTicket(body, req.user);
  }

  @Get()
  getTickets(@Req() req: any) {
    return this.ticketsService.getTickets(req.user);
  }

  @Get(':id')
  getTicket(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.ticketsService.getTicket(id, req.user);
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
    @Req() req: any,
  ) {
    return this.ticketsService.addMessage(id, body, req.user);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  updateTicketStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateTicketStatusDto,
    @Req() req: any,
  ) {
    return this.ticketsService.updateTicketStatus(id, body, req.user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  deleteTicket(@Param('id', ParseIntPipe) id: number) {
    return this.ticketsService.deleteTicket(id);
  }
}
