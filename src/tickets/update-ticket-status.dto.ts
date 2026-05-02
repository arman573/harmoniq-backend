import { IsEnum } from 'class-validator';
import { TicketStatus } from './ticket.entity';

export class UpdateTicketStatusDto {
  @IsEnum(TicketStatus)
  status!: TicketStatus;
}
