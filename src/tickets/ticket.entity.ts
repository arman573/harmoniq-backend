import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Customer } from '../customers/customer.entity';
import { Message } from './message.entity';

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

  @ManyToOne(() => Customer, (customer) => customer.tickets, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  customer?: Customer | null;

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
