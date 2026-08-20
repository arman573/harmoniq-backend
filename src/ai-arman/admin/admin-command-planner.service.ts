import { Injectable } from '@nestjs/common';

export type AiArmanAdminCommandPlan = {
  caseId: string;
  readCase: boolean;
  readOrderContext: boolean;
  writeAction: 'pause' | 'complete' | null;
  explicitAdminApproval: boolean;
};

const CASE_ID_PATTERN = /\bHQR-[A-Z0-9-]{3,40}\b/i;
const READ_CASE_PATTERN = /\b(öppna|läs|visa|hämta|kontrollera|historik|ärende)\b/i;
const ORDER_CONTEXT_PATTERN = /\b(order|beställning|spår|tracking|sändnings.?id|paket|leverans|frakt|schenker|nshift)\b/i;
const PAUSE_IMPERATIVE_PATTERN = /\b(pausa|lägg(?:\s+ärendet)?\s+i\s+vänt(?:ar)?|flytta(?:\s+ärendet)?\s+till\s+vänt(?:ar)?)\b/i;
const COMPLETE_IMPERATIVE_PATTERN = /\b(klarmarkera|markera(?:\s+ärendet)?\s+som\s+klart|gör(?:\s+ärendet)?\s+klart)\b/i;
const DELIBERATIVE_PATTERN = /\b(borde|ska\s+vi|kan\s+vi|tycker\s+du|rekommenderar\s+du|är\s+det\s+rätt|bör\s+vi)\b/i;

@Injectable()
export class AiArmanAdminCommandPlannerService {
  plan(adminQuestion: unknown, currentCaseId: unknown): AiArmanAdminCommandPlan | null {
    const text = clean(adminQuestion, 1200);
    if (!text) return null;

    const explicitCaseId = text.match(CASE_ID_PATTERN)?.[0] || '';
    const caseId = normalizeCaseId(explicitCaseId || currentCaseId);
    if (!caseId) return null;

    const deliberative = DELIBERATIVE_PATTERN.test(text) || text.trim().endsWith('?');
    const pause = PAUSE_IMPERATIVE_PATTERN.test(text);
    const complete = COMPLETE_IMPERATIVE_PATTERN.test(text);
    const ambiguousWrite = pause && complete;

    let writeAction: 'pause' | 'complete' | null = null;
    let explicitAdminApproval = false;
    if (!deliberative && !ambiguousWrite) {
      if (pause) writeAction = 'pause';
      if (complete) writeAction = 'complete';
      explicitAdminApproval = writeAction !== null;
    }

    return {
      caseId,
      readCase: READ_CASE_PATTERN.test(text) || writeAction !== null,
      readOrderContext: ORDER_CONTEXT_PATTERN.test(text),
      writeAction,
      explicitAdminApproval,
    };
  }
}

function normalizeCaseId(value: unknown): string {
  const normalized = String(value || '').trim().toUpperCase();
  return /^HQR-[A-Z0-9-]{3,40}$/.test(normalized) ? normalized : '';
}

function clean(value: unknown, maxLength: number): string {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, maxLength);
}
