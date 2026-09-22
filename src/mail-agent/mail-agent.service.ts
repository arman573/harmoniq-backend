import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import crypto from 'node:crypto';
import { classifyMail } from './mail-agent.classifier';
import { MailAgentMessage } from './mail-agent-message.entity';
import { MailEnvelope } from './mail-agent.types';

@Injectable()
export class MailAgentService {
  constructor(
    @InjectRepository(MailAgentMessage)
    private readonly messageRepository: Repository<MailAgentMessage>,
  ) {}

  triage(message: MailEnvelope) {
    return {
      message: sanitizeEnvelope(message),
      triage: classifyMail(message),
    };
  }

  async ingest(message: MailEnvelope) {
    const normalized = sanitizeEnvelope(message);
    const mailbox = String(normalized.mailbox || '').trim().toLowerCase();
    const providerMessageId = String(
      normalized.providerMessageId || normalized.id || '',
    ).trim();

    if (!mailbox) {
      return { ok: false, code: 'missing_mailbox' };
    }

    if (!providerMessageId) {
      return { ok: false, code: 'missing_provider_message_id' };
    }

    const rfcMessageId = normalizeRfcMessageId(normalized.rfcMessageId);
    const dedupeKey = String(normalized.dedupeKey || '').trim()
      || buildDedupeKey(normalized, rfcMessageId);

    const existingByProvider = await this.messageRepository.findOne({
      where: { mailbox, providerMessageId },
    });

    if (existingByProvider) {
      return {
        ok: true,
        duplicate: true,
        duplicateScope: 'same_mailbox_provider_id',
        id: existingByProvider.id,
        item: existingByProvider,
      };
    }

    const existingGlobal = dedupeKey
      ? await this.messageRepository.findOne({ where: { dedupeKey } })
      : null;

    if (existingGlobal) {
      const seen = new Set(existingGlobal.seenInMailboxes || [existingGlobal.mailbox]);
      seen.add(mailbox);
      existingGlobal.seenInMailboxes = [...seen].sort();
      if (!existingGlobal.rfcMessageId && rfcMessageId) {
        existingGlobal.rfcMessageId = rfcMessageId;
      }
      const saved = await this.messageRepository.save(existingGlobal);
      return {
        ok: true,
        duplicate: true,
        duplicateScope: 'cross_mailbox',
        id: saved.id,
        item: saved,
      };
    }

    const triage = classifyMail(normalized);
    const receivedAt = parseDate(normalized.receivedAt);

    const entity = this.messageRepository.create({
      mailbox,
      providerMessageId,
      rfcMessageId: rfcMessageId || undefined,
      dedupeKey: dedupeKey || undefined,
      seenInMailboxes: [mailbox],
      threadId: normalized.threadId || '',
      provider: 'gmail',
      direction: normalized.direction || 'inbound',
      from: normalized.from,
      to: normalized.to || [],
      cc: normalized.cc || [],
      subject: normalized.subject || '',
      body: normalized.body || '',
      category: triage.category,
      priority: triage.priority,
      nextAction: triage.nextAction,
      specialist: triage.specialist,
      confidence: triage.confidence,
      requiresHumanApproval: triage.requiresHumanApproval,
      automationAllowed: triage.automationAllowed,
      reasons: triage.reasons,
      riskFlags: triage.riskFlags,
      receivedAt,
    });

    const saved = await this.messageRepository.save(entity);

    return {
      ok: true,
      duplicate: false,
      id: saved.id,
      item: saved,
    };
  }

  async getAttentionQueue() {
    const items = await this.messageRepository.find({
      where: {
        resolvedAt: IsNull(),
      },
      order: {
        receivedAt: 'DESC',
        firstSeenAt: 'DESC',
      },
      take: 250,
    });

    return items
      .filter((item) => shouldSurface(item))
      .sort(compareAttentionItems)
      .map((item) => ({
        ...item,
        attentionReason: getAttentionReason(item),
      }));
  }

  async acknowledge(id: number) {
    const item = await this.messageRepository.findOne({ where: { id } });

    if (!item) {
      return { ok: false, code: 'not_found' };
    }

    item.acknowledgedAt = new Date();
    const saved = await this.messageRepository.save(item);
    return { ok: true, item: saved };
  }

  async resolve(id: number) {
    const item = await this.messageRepository.findOne({ where: { id } });

    if (!item) {
      return { ok: false, code: 'not_found' };
    }

    item.resolvedAt = new Date();
    const saved = await this.messageRepository.save(item);
    return { ok: true, item: saved };
  }
}

function sanitizeEnvelope(message: MailEnvelope): MailEnvelope {
  return {
    ...message,
    mailbox: String(message.mailbox || '').trim().toLowerCase(),
    providerMessageId: String(message.providerMessageId || message.id || '').trim(),
    rfcMessageId: String(message.rfcMessageId || '').trim(),
    dedupeKey: String(message.dedupeKey || '').trim(),
    from: String(message.from || '').trim(),
    to: (message.to || []).map((value) => String(value).trim()).filter(Boolean),
    cc: (message.cc || []).map((value) => String(value).trim()).filter(Boolean),
    subject: String(message.subject || '').trim(),
    body: String(message.body || ''),
    labels: (message.labels || []).map((value) => String(value).trim()).filter(Boolean),
  };
}

function parseDate(value?: string) {
  if (!value) return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function shouldSurface(item: MailAgentMessage) {
  if (item.priority === 'critical' || item.priority === 'high') return true;

  return [
    'invoice_finance',
    'returns_claims',
    'supplier',
    'order_purchase',
    'compliance_legal',
    'marketing_ads',
    'system_alert',
  ].includes(item.category || '');
}

function compareAttentionItems(a: MailAgentMessage, b: MailAgentMessage) {
  const weight = (priority?: string) =>
    priority === 'critical' ? 4 :
      priority === 'high' ? 3 :
        priority === 'normal' ? 2 : 1;

  const priorityDelta = weight(b.priority) - weight(a.priority);
  if (priorityDelta !== 0) return priorityDelta;

  const aTime = a.receivedAt?.getTime() || a.firstSeenAt?.getTime() || 0;
  const bTime = b.receivedAt?.getTime() || b.firstSeenAt?.getTime() || 0;
  return bTime - aTime;
}

function getAttentionReason(item: MailAgentMessage) {
  if (item.priority === 'critical') return 'critical_priority';
  if (item.priority === 'high') return 'high_priority';
  if (item.category === 'invoice_finance') return 'finance_no_miss';
  if (item.category === 'compliance_legal') return 'compliance_review';
  if (item.category === 'returns_claims') return 'customer_case';
  if (item.category === 'order_purchase' || item.category === 'supplier') return 'supplier_or_order';
  return 'important_review';
}


function normalizeRfcMessageId(value?: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.replace(/^<|>$/g, '').trim().toLowerCase();
}

function buildDedupeKey(message: MailEnvelope, rfcMessageId: string) {
  if (rfcMessageId) return `rfc:${rfcMessageId}`;

  const normalizedSubject = String(message.subject || '')
    .trim()
    .toLowerCase()
    .replace(/^((re|fw|fwd):\s*)+/i, '')
    .replace(/\s+/g, ' ');

  const normalizedFrom = String(message.from || '')
    .trim()
    .toLowerCase();

  const received = parseDate(message.receivedAt);
  const minuteBucket = new Date(
    Math.floor(received.getTime() / 60000) * 60000,
  ).toISOString();

  const bodyFingerprint = String(message.body || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1200);

  const basis = [
    normalizedFrom,
    normalizedSubject,
    minuteBucket,
    bodyFingerprint,
  ].join('\n');

  return `sha256:${crypto.createHash('sha256').update(basis, 'utf8').digest('hex')}`;
}
