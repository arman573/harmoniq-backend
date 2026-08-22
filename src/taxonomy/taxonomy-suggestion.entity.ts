import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SuggestionStatus = 'pending' | 'approved' | 'rejected';

@Entity()
export class TaxonomySuggestion {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  suggestedKey!: string;

  @Column()
  label!: string;

  @Column({ nullable: true })
  domain?: string;

  @Column({ nullable: true })
  kind?: string;

  @Column({ nullable: true })
  reason?: string;

  @Column({ default: 'pending' })
  status!: SuggestionStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
