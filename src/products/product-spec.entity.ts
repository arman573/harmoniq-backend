import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Product } from './product.entity';

@Entity()
export class ProductSpec {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Product, (product) => product.specs, { onDelete: 'CASCADE' })
  product!: Product;

  @Column()
  name!: string;

  @Column({ nullable: true })
  value?: string;

  @Column({ nullable: true })
  normalizedKey?: string;

  @Column({ nullable: true })
  source?: string;
}
