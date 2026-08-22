import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Product } from './product.entity';

@Entity()
export class ProductTag {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Product, (product) => product.tags, { onDelete: 'CASCADE' })
  product!: Product;

  @Column({ nullable: true })
  sourceCategory?: string;

  @Column()
  name!: string;

  @Column({ nullable: true })
  normalizedKey?: string;

  @Column({ nullable: true })
  domain?: string;

  @Column({ nullable: true })
  kind?: string;
}
