import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Customer } from '../customers/customer.entity';

@Entity()
export class CustomerProfile {
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToOne(() => Customer, (customer) => customer.profile, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  customer!: Customer;

  @Column({ type: 'jsonb', default: {} })
  attributes!: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
