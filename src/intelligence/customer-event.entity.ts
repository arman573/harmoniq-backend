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

  @Column()
  type!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @ManyToOne(() => Customer, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  customer!: Customer;

  @CreateDateColumn()
  createdAt!: Date;
}
