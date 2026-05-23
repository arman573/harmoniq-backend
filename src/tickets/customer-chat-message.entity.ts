import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Customer } from './customer.entity';
import { CustomerChatConversation } from './customer-chat-conversation.entity';
import type {
  CustomerChatIntegrationStatus,
  CustomerChatIntent,
  CustomerChatPolicyDecision,
} from './customer-chat.types';

export enum CustomerChatMessageRole {
  User = 'user',
  Assistant = 'assistant',
  Human = 'human',
}

@Entity()
export class CustomerChatMessage {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(
    () => CustomerChatConversation,
    (conversation) => conversation.messages,
    {
      nullable: false,
      onDelete: 'CASCADE',
    },
  )
  conversation!: CustomerChatConversation;

  @ManyToOne(() => Customer, { nullable: false, onDelete: 'CASCADE' })
  customer!: Customer;

  @Column({
    type: 'enum',
    enum: CustomerChatMessageRole,
  })
  role!: CustomerChatMessageRole;

  @Column({ type: 'text' })
  content!: string;

  @Column({ nullable: true })
  intentType?: string;

  @Column({ type: 'float', nullable: true })
  intentConfidence?: number;

  @Column({ nullable: true })
  policyRoute?: string;

  @Column({ default: false })
  escalationRequired!: boolean;

  @Column({ nullable: true })
  boundaryType?: string;

  @Column({ type: 'jsonb', nullable: true })
  policyReasons?: string[];

  @Column({ type: 'jsonb', nullable: true })
  intent?: CustomerChatIntent;

  @Column({ type: 'jsonb', nullable: true })
  policyDecision?: CustomerChatPolicyDecision;

  @Column({ type: 'jsonb', nullable: true })
  integrations?: {
    recommendations: CustomerChatIntegrationStatus;
    support: CustomerChatIntegrationStatus;
  };

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ type: 'int', nullable: true })
  createdByUserId?: number | null;

  @CreateDateColumn()
  createdAt!: Date;
}
