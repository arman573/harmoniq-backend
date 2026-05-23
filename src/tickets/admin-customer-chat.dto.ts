import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CustomerChatConversationStatus } from './customer-chat-conversation.entity';

export const ADMIN_CHAT_PRIORITIES = ['low', 'medium', 'high'] as const;

export type AdminChatPriority = (typeof ADMIN_CHAT_PRIORITIES)[number];

export class AdminCustomerChatInboxQueryDto {
  @IsOptional()
  @IsIn(Object.values(CustomerChatConversationStatus))
  status?: CustomerChatConversationStatus;

  @IsOptional()
  @IsString()
  escalationRequired?: string;

  @IsOptional()
  @IsString()
  route?: string;

  @IsOptional()
  @IsString()
  intent?: string;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsIn(ADMIN_CHAT_PRIORITIES)
  priority?: AdminChatPriority;

  @IsOptional()
  @IsString()
  customerId?: string;
}

export class AssignCustomerChatConversationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assignedToUserId?: number | null;
}

export class UpdateCustomerChatConversationStatusDto {
  @IsIn(Object.values(CustomerChatConversationStatus))
  status!: CustomerChatConversationStatus;
}

export class CreateCustomerChatInternalNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body!: string;
}

export class CreateCustomerChatHumanReplyDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(2000)
  message!: string;
}
