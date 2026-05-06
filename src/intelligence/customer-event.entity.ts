import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Customer } from '../customers/customer.entity';

@Entity()
export class CustomerEvent {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  customer!: Customer;

  @Column()
  type!: string;

  @Column({ type: 'jsonb', nullable: true })
  payload?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;
}
