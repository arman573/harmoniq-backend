import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type IngredientIrritationRisk = 'low' | 'medium' | 'high';

@Entity()
export class Ingredient {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ unique: true })
  normalizedName!: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  aliases!: string[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  benefits!: string[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  risks!: string[];

  @Column({ type: 'int', nullable: true })
  comedogenicRating?: number | null;

  @Column({ type: 'varchar', nullable: true })
  irritationRisk?: IngredientIrritationRisk | null;

  @Column({ type: 'boolean', nullable: true })
  fungalAcneSafe?: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  pregnancySafe?: boolean | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
