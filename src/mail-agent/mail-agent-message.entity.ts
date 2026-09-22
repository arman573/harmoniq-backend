import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
@Index(['mailbox', 'providerMessageId'], { unique: true })
export class MailAgentMessage {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  mailbox!: string;

  @Column()
  providerMessageId!: string;

  @Column({ nullable: true })
  rfcMessageId?: string;

  @Index()
  @Column({ nullable: true })
  dedupeKey?: string;

  @Column({ type: 'simple-json', nullable: true })
  seenInMailboxes?: string[];

  @Column({ nullable: true })
  threadId?: string;

  @Column({ default: 'gmail' })
  provider!: string;

  @Column({ default: 'inbound' })
  direction!: 'inbound' | 'outbound';

  @Column()
  from!: string;

  @Column({ type: 'simple-json', nullable: true })
  to?: string[];

  @Column({ type: 'simple-json', nullable: true })
  cc?: string[];

  @Column({ nullable: true })
  subject?: string;

  @Column({ type: 'text', nullable: true })
  body?: string;

  @Column({ nullable: true })
  category?: string;

  @Column({ nullable: true })
  priority?: string;

  @Column({ nullable: true })
  nextAction?: string;

  @Column({ nullable: true })
  specialist?: string;

  @Column({ type: 'float', nullable: true })
  confidence?: number;

  @Column({ default: true })
  requiresHumanApproval!: boolean;

  @Column({ default: false })
  automationAllowed!: boolean;

  @Column({ type: 'simple-json', nullable: true })
  reasons?: string[];

  @Column({ type: 'simple-json', nullable: true })
  riskFlags?: string[];

  @Column({ type: 'timestamptz', nullable: true })
  receivedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  acknowledgedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt?: Date;

  @CreateDateColumn()
  firstSeenAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
