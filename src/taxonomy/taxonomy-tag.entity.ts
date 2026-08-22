import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class TaxonomyTag {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ nullable: true })
  normalizedKey?: string;

  @Column({ nullable: true })
  sourceCategory?: string;

  @Column({ nullable: true })
  domain?: string;

  @Column({ nullable: true })
  kind?: string;

  @Column({ type: 'jsonb', nullable: true })
  synonyms?: string[];

  @Column({ default: 'masterdata' })
  source!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
