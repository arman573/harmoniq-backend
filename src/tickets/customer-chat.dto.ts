import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CUSTOMER_CHAT_CHANNELS } from './customer-chat.types';
import type { CustomerChatChannel } from './customer-chat.types';

export class CustomerChatRequestDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  conversationId?: string;

  @IsOptional()
  @IsIn(CUSTOMER_CHAT_CHANNELS)
  channel?: CustomerChatChannel;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}
