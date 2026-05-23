import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Customer } from '../customers/customer.entity';
import { CustomerChatMessage } from './customer-chat-message.entity';
import type { CustomerChatChannel } from './customer-chat.types';

export enum CustomerChatConversationStatus {
  Open = 'open',
  Pending = 'pending',
  Escalated = 'escalated',
  Resolved = 'resolved',
  Closed = 'closed',
}

@Entity()
@Index(['conversationId'])
export class CustomerChatConversation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  conversationId!: string;

  @ManyToOne(() => Customer, { nullable: false, onDelete: 'CASCADE' })
  customer!: Customer;

  @Column({ default: 'web' })
  channel!: CustomerChatChannel;

  @Column({
    type: 'enum',
    enum: CustomerChatConversationStatus,
    default: CustomerChatConversationStatus.Open,
  })
  status!: CustomerChatConversationStatus;

  @Column({ nullable: true })
  lastIntentType?: string;

  @Column({ type: 'float', nullable: true })
  lastIntentConfidence?: number;

  @Column({ nullable: true })
  lastPolicyRoute?: string;

  @Column({ nullable: true })
  lastBoundaryType?: string;

  @Column({ default: false })
  escalationRequired!: boolean;

  @Column({ type: 'int', nullable: true })
  assignedToUserId?: number | null;

  @Column({ default: false })
  humanHandled!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  humanHandledAt?: Date | null;

  @Column({ type: 'int', nullable: true })
  humanHandledByUserId?: number | null;

  @Column({ type: 'timestamp', nullable: true })
  lastHumanReplyAt?: Date | null;

  @OneToMany(() => CustomerChatMessage, (message) => message.conversation)
  messages!: CustomerChatMessage[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
