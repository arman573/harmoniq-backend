import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Message } from './message.entity';
import { User } from '../users/user.entity';
import { Customer } from './customer.entity';

export enum TicketStatus {
  Open = 'open',
  InProgress = 'in_progress',
  Closed = 'closed',
}

export enum TicketChannel {
  Chat = 'chat',
  Email = 'email',
  Manual = 'manual',
}

@Entity()
export class Ticket {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  subject!: string;

  @Column()
  customerEmail!: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  owner!: User;

  @ManyToOne(() => Customer, (customer) => customer.tickets, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  customer!: Customer;

  @Column({ default: TicketChannel.Manual })
  channel!: TicketChannel;

  @Column({ nullable: true })
  description?: string;

  @Column({ default: TicketStatus.Open })
  status!: TicketStatus;

  @OneToMany(() => Message, (message) => message.ticket)
  messages!: Message[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
