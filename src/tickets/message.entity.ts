import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Ticket } from './ticket.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user.entity';

export enum MessageType {
  MESSAGE = 'message',
  SYSTEM = 'system',
}

export enum MessageChannel {
  CHAT = 'chat',
  EMAIL = 'email',
  SYSTEM = 'system',
}

@Entity()
export class Message {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Ticket, (ticket) => ticket.messages, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  ticket!: Ticket;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  author!: User;

  @Column({
    type: 'enum',
    enum: UserRole,
  })
  sender!: UserRole;

  @Column({
    type: 'enum',
    enum: MessageType,
    default: MessageType.MESSAGE,
  })
  type!: MessageType;

  @Column({
    type: 'enum',
    enum: MessageChannel,
    default: MessageChannel.CHAT,
  })
  channel!: MessageChannel;

  @Column({ type: 'text' })
  content!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
