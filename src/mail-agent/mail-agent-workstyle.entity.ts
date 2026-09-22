import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type MailAgentWorkstyleStatus = 'draft' | 'active' | 'disabled';

@Entity()
export class MailAgentWorkstyle {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'text' })
  instruction!: string;

  @Column({ type: 'text' })
  summary!: string;

  @Column({ default: 'draft' })
  status!: MailAgentWorkstyleStatus;

  @Column({ type: 'simple-json', nullable: true })
  scope?: Record<string, unknown>;

  @Column({ type: 'simple-json', nullable: true })
  conditions?: Record<string, unknown>;

  @Column({ type: 'simple-json', nullable: true })
  actions?: Record<string, unknown>;

  @Column({ type: 'simple-json', nullable: true })
  warnings?: string[];

  @Column({ default: 'openai_responses' })
  interpreter!: string;

  @Column({ nullable: true })
  model?: string;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  disabledAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
