import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Customer } from './customer.entity';

@Entity()
export class CustomerFact {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  customer!: Customer;

  @Column()
  type!: string;

  @Column()
  value!: string;

  @Column({ default: 'unknown' })
  source!: string;

  @Column({ type: 'float', default: 0.5 })
  confidence!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
