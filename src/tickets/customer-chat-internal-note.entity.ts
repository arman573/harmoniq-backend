import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CustomerChatConversation } from './customer-chat-conversation.entity';

@Entity()
export class CustomerChatInternalNote {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => CustomerChatConversation, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  conversation!: CustomerChatConversation;

  @Column({ type: 'int', nullable: true })
  authorUserId?: number | null;

  @Column({ type: 'text' })
  body!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
