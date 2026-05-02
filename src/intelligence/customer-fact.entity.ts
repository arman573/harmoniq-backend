import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Customer } from '../customers/customer.entity';

@Entity()
export class CustomerFact {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  type!: string;

  @Column()
  value!: string;

  @Column({ default: 'system' })
  source!: string;

  @Column({ type: 'float', default: 1 })
  confidence!: number;

  @ManyToOne(() => Customer, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  customer!: Customer;

  @CreateDateColumn()
  createdAt!: Date;
}
