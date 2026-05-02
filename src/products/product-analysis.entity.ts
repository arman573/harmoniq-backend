import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Product } from './product.entity';

@Entity()
export class ProductAnalysis {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Product, (product) => product.analyses, { onDelete: 'CASCADE' })
  product!: Product;

  @Column({ default: 'pending' })
  status!: string;

  @Column({ nullable: true })
  analysisSource?: string;

  @Column({ type: 'jsonb', nullable: true })
  rawAnalysis?: Record<string, unknown>;
}
