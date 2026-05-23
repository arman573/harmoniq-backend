import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from './product.entity';

@Entity()
export class ProductAnalysis {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Product, (product) => product.analyses, {
    onDelete: 'CASCADE',
  })
  product!: Product;

  @Column({ default: 'pending' })
  status!: string;

  @Column({ nullable: true })
  analysisSource?: string;

  @Column({ nullable: true })
  analysisHash?: string;

  @Column({ nullable: true })
  sourceHash?: string;

  @Column({ nullable: true })
  inciHash?: string;

  @Column({ nullable: true })
  metadataHash?: string;

  @Column({ type: 'float', nullable: true })
  confidence?: number;

  @Column({ type: 'jsonb', nullable: true })
  suitableFor?: string[];

  @Column({ type: 'jsonb', nullable: true })
  notSuitableFor?: string[];

  @Column({ type: 'jsonb', nullable: true })
  warnings?: string[];

  @Column({ type: 'jsonb', nullable: true })
  matchedConcepts?: string[];

  @Column({ type: 'jsonb', nullable: true })
  scores?: Record<string, number>;

  @Column({ type: 'jsonb', nullable: true })
  ingredients?: string[];

  @Column({ type: 'jsonb', nullable: true })
  rawAnalysis?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
