import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Ticket } from './ticket.entity';

@Entity()
export class Message {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Ticket, (ticket) => ticket.messages, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  ticket!: Ticket;

  @Column()
  sender!: string;

  @Column({ type: 'text' })
  content!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
