import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
@Index(['path'], { unique: true })
export class TaxonomyCategory {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column()
  path!: string;

  @Column({ nullable: true })
  parentPath?: string;

  @Column({ type: 'int', default: 0 })
  depth!: number;

  @Column({ default: 'masterdata' })
  source!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
