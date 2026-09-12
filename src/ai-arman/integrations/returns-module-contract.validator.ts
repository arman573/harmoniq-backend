import {
  RETURNS_MODULE_CONTRACT_VERSION,
  ReturnsModuleCaseContextRequest,
  ReturnsModuleCaseContextResponse,
  ReturnsModuleCaseMessage,
  ReturnsModuleCaseType,
  ReturnsModuleCustomerCase,
  ReturnsModuleVerifiedCustomerContext,
  ReturnsModuleWriteAuthorization,
} from './returns-module.types';

const MAX_RESPONSE_BYTES = 64 * 1024;
const MAX_CASES = 20;
const MAX_MESSAGES_PER_CASE = 40;
const MAX_MESSAGE_TEXT = 3000;
const MAX_SUBJECT = 300;
const MAX_STATUS = 120;
const MAX_STATUS_LABEL = 200;
const MAX_ID = 128;
const ORDER_ID_PATTERN = /^[0-9]{3,12}$/;
const CASE_ID_PATTERN = /^HQR-[A-Za-z0-9-]{3,40}$/;
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;
const SAFE_CASE_TYPES = new Set<ReturnsModuleCaseType>([
  'return',
  'claim',
  'wrong_item',
  'missing_item',
  'support',
]);

export function validateReturnsModuleVerifiedContext(
  value: ReturnsModuleVerifiedCustomerContext,
  expectedOrderId: string,
  now = new Date(),
): boolean {
  if (!value || typeof value !== 'object') return false;
  if (!boundedText(value.verificationId, MAX_ID)) return false;
  if (!['order_email_otp', 'account_assertion'].includes(value.verificationMethod)) {
    return false;
  }
  if (!SHA256_HEX_PATTERN.test(String(value.subjectHash || ''))) return false;
  if (!Array.isArray(value.verifiedOrderIds) || value.verifiedOrderIds.length === 0) {
    return false;
  }
  if (!value.verifiedOrderIds.every((orderId) => ORDER_ID_PATTERN.test(orderId))) {
    return false;
  }
  if (!ORDER_ID_PATTERN.test(expectedOrderId)) return false;
  if (!value.verifiedOrderIds.includes(expectedOrderId)) return false;

  const verifiedAt = parseTimestamp(value.verifiedAt);
  const expiresAt = parseTimestamp(value.expiresAt);
  const nowMs = now.getTime();
  if (verifiedAt === null || expiresAt === null || !Number.isFinite(nowMs)) return false;
  if (verifiedAt > nowMs + 60_000) return false;
  if (expiresAt <= nowMs || expiresAt <= verifiedAt) return false;
  return true;
}

export function validateReturnsModuleCaseContextRequest(
  value: ReturnsModuleCaseContextRequest,
  now = new Date(),
): boolean {
  if (!value || value.contractVersion !== RETURNS_MODULE_CONTRACT_VERSION) {
    return false;
  }
  if (!ORDER_ID_PATTERN.test(String(value.orderId || ''))) return false;
  if (value.caseId !== undefined && !CASE_ID_PATTERN.test(String(value.caseId || ''))) {
    return false;
  }
  return validateReturnsModuleVerifiedContext(value.verification, value.orderId, now);
}

export function validateReturnsModuleWriteAuthorization(
  value: ReturnsModuleWriteAuthorization,
  expectedOrderId: string,
  now = new Date(),
): boolean {
  if (!value || typeof value !== 'object') return false;
  if (!validateReturnsModuleVerifiedContext(value.verification, expectedOrderId, now)) {
    return false;
  }
  if (!boundedText(value.confirmationToken, MAX_ID)) return false;
  if (!boundedText(value.idempotencyKey, MAX_ID)) return false;
  return true;
}

export function parseReturnsModuleCaseContextResponse(
  value: unknown,
  expectedOrderId: string,
): ReturnsModuleCaseContextResponse | null {
  if (!isRecord(value) || value.ok !== true) return null;
  if (value.contractVersion !== RETURNS_MODULE_CONTRACT_VERSION) return null;
  if (safeSerializedSize(value) > MAX_RESPONSE_BYTES) return null;
  if (!ORDER_ID_PATTERN.test(expectedOrderId) || value.orderId !== expectedOrderId) {
    return null;
  }
  if (!Array.isArray(value.cases) || value.cases.length > MAX_CASES) return null;

  const cases: ReturnsModuleCustomerCase[] = [];
  const caseIds = new Set<string>();
  for (const item of value.cases) {
    const parsed = parseCase(item, expectedOrderId);
    if (!parsed || caseIds.has(parsed.caseId)) return null;
    caseIds.add(parsed.caseId);
    cases.push(parsed);
  }

  return {
    ok: true,
    contractVersion: RETURNS_MODULE_CONTRACT_VERSION,
    orderId: expectedOrderId,
    cases,
  };
}

function parseCase(value: unknown, expectedOrderId: string): ReturnsModuleCustomerCase | null {
  if (!isRecord(value)) return null;
  const caseId = boundedText(value.caseId, MAX_ID);
  const orderId = boundedText(value.orderId, MAX_ID);
  const caseType = boundedText(value.caseType, 40) as ReturnsModuleCaseType | null;
  const status = boundedText(value.status, MAX_STATUS, true);
  const statusLabel = boundedText(value.statusLabel, MAX_STATUS_LABEL, true);
  const createdAt = validTimestamp(value.createdAt);
  const updatedAt = validTimestamp(value.updatedAt);

  if (
    !caseId ||
    !CASE_ID_PATTERN.test(caseId) ||
    orderId !== expectedOrderId ||
    !caseType ||
    !SAFE_CASE_TYPES.has(caseType) ||
    status === null ||
    statusLabel === null ||
    !createdAt ||
    !updatedAt ||
    !Array.isArray(value.messages) ||
    value.messages.length > MAX_MESSAGES_PER_CASE
  ) {
    return null;
  }

  const messages: ReturnsModuleCaseMessage[] = [];
  const messageIds = new Set<string>();
  for (const message of value.messages) {
    const parsed = parseMessage(message);
    if (!parsed || messageIds.has(parsed.id)) return null;
    messageIds.add(parsed.id);
    messages.push(parsed);
  }

  return {
    caseId,
    orderId,
    caseType,
    status,
    statusLabel,
    createdAt,
    updatedAt,
    messages,
  };
}

function parseMessage(value: unknown): ReturnsModuleCaseMessage | null {
  if (!isRecord(value)) return null;
  const id = boundedText(value.id, MAX_ID);
  const subject = boundedText(value.subject, MAX_SUBJECT, true);
  const text = boundedText(value.text, MAX_MESSAGE_TEXT, true);
  const date = validTimestamp(value.date);
  const direction = value.direction;
  const sender = value.sender;

  if (
    !id ||
    subject === null ||
    text === null ||
    !date ||
    !['inbound', 'outbound'].includes(String(direction)) ||
    !['Kund', 'HARMONIQ'].includes(String(sender))
  ) {
    return null;
  }

  if (direction === 'inbound' && sender !== 'Kund') return null;
  if (direction === 'outbound' && sender !== 'HARMONIQ') return null;

  return {
    id,
    direction: direction as ReturnsModuleCaseMessage['direction'],
    sender: sender as ReturnsModuleCaseMessage['sender'],
    subject,
    text,
    date,
  };
}

function boundedText(
  value: unknown,
  maxLength: number,
  allowEmpty = false,
): string | null {
  if (typeof value !== 'string') return null;
  if (hasDangerousInvisible(value)) return null;
  const trimmed = value.trim();
  if (!allowEmpty && !trimmed) return null;
  if (trimmed.length > maxLength) return null;
  return trimmed;
}

function validTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? value : null;
}

function parseTimestamp(value: unknown): number | null {
  const valid = validTimestamp(value);
  if (!valid) return null;
  const parsed = Date.parse(valid);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeSerializedSize(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function hasDangerousInvisible(value: string): boolean {
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/.test(
    value,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
