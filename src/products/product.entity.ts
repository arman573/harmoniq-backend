import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProductSpec } from './product-spec.entity';
import { ProductTag } from './product-tag.entity';
import { ProductAnalysis } from './product-analysis.entity';

@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ nullable: true })
  externalId?: string;

  @Column({ nullable: true })
  sku?: string;

  @Column({ nullable: true })
  articleNumber?: string;

  @Column()
  name!: string;

  @Column({ nullable: true })
  brand?: string;

  @Column({ nullable: true })
  categoryName?: string;

  @Column({ nullable: true })
  categoryPath?: string;

  @Column({ nullable: true })
  mainCategory?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'float', nullable: true })
  price?: number;

  @Column({ type: 'int', default: 0 })
  quantity!: number;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ default: false })
  isDiscontinued!: boolean;

  @Column({ default: 'manual' })
  source!: string;

  @Column({ type: 'jsonb', nullable: true })
  rawData?: Record<string, unknown>;

  @OneToMany(() => ProductSpec, (spec) => spec.product)
  specs!: ProductSpec[];

  @OneToMany(() => ProductTag, (tag) => tag.product)
  tags!: ProductTag[];

  @OneToMany(() => ProductAnalysis, (analysis) => analysis.product)
  analyses!: ProductAnalysis[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
