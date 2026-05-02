import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class TaxonomySpec {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ nullable: true })
  normalizedKey?: string;

  @Column({ nullable: true })
  sourceColumn?: string;

  @Column({ nullable: true })
  language?: string;

  @Column({ type: 'jsonb', nullable: true })
  allowedValues?: string[];

  @Column({ default: 'masterdata' })
  source!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
