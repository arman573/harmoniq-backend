import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CustomerProfile } from '../tickets/customer-profile.entity';
import { Ticket } from '../tickets/ticket.entity';

@Entity()
export class Customer {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  email!: string;

  @Column({ nullable: true })
  name?: string;

  @OneToMany(() => Ticket, (ticket) => ticket.customer)
  tickets!: Ticket[];

  @OneToOne(() => CustomerProfile, (profile) => profile.customer)
  profile!: CustomerProfile;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
