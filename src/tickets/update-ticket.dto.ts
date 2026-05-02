import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { TicketChannel, TicketStatus } from './ticket.entity';

export class UpdateTicketDto {
  @IsString()
  @IsOptional()
  subject?: string;

  @IsEmail()
  @IsOptional()
  customerEmail?: string;

  @IsEnum(TicketChannel)
  @IsOptional()
  channel?: TicketChannel;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TicketStatus)
  @IsOptional()
  status?: TicketStatus;
}
