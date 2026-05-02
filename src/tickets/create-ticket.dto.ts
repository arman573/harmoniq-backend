import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { TicketChannel, TicketStatus } from './ticket.entity';

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsEmail()
  customerEmail!: string;

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
