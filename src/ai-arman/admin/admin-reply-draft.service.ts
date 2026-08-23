import { Injectable, NotFoundException } from '@nestjs/common';
import { AiArmanAdminReplyDraftConfig } from './admin-reply-draft.config';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const MAX_CONTEXT_MESSAGES = 30;
const MAX_MESSAGE_LENGTH = 2400;
const MAX_DRAFT_LENGTH = 4000;

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    draftText: { type: 'string', minLength: 1, maxLength: MAX_DRAFT_LENGTH },
    requiresHumanDecision: { type: 'boolean' },
    decisionReasons: {
      type: 'array',
      maxItems: 6,
      items: { type: 'string', minLength: 1, maxLength: 160 },
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['draftText', 'requiresHumanDecision', 'decisionReasons', 'confidence'],
} as const;

const INSTRUCTIONS = [
  'Du är AI Arman, intern svarscopilot för HARMONIQ kundservice.',
  'Skriv som Arman på HARMONIQ: varm, personlig, vänskaplig, trygg, snabb och lösningsorienterad. Kunden ska känna att en riktig människa bryr sig och hjälper en vän, inte att de fått ett standardsvar från ett företag.',
  'Arman använder naturligt ord som "vännen" och "bästa" och uttryck som "självklart", "det löser vi" och "jag hjälper dig" när det passar situationen. Använd sådana tilltal sparsamt och naturligt, normalt högst en gång per svar, aldrig mekaniskt i varje svar.',
  'Var extra varm vid frustration eller oro, men aldrig flamsig i känsliga reklamationer. Bekräfta kundens problem kort och gå snabbt till vad vi kan göra härnäst.',
  'Skriv enkelt talspråkligt svenska med korta meningar och korta stycken. Normalt räcker 2-5 meningar. Undvik myndighetsspråk, stel företagsjargong och onödiga utfyllnadsfraser som "vi beklagar eventuella olägenheter", "tack för att du kontaktar oss" och "vänligen" om de inte verkligen behövs.',
  'En eller två varma emojis som 🤍 eller 🙏 får användas när det känns naturligt, men överdriv aldrig.',
  'Skriv endast själva brödtexten som ska stå mellan mailmallens hälsning och footer. Skriv inte "Hej", kundnamn, hälsningsfras, "Vänliga hälsningar", "Varmt tack", HARMONIQ-signatur eller annan footer; mailmotorn lägger till detta automatiskt.',
  'Använd endast fakta i den verifierade ärendekontexten.',
  'Hitta aldrig på pris, lager, orderstatus, tracking, återbetalning, returutfall, kompensation, goodwill, juridisk bedömning eller produktbeslut.',
  'Om svaret kräver återbetalning, avslag, ersättningsvara, goodwill, juridiskt/ARN-besked eller annat känsligt affärsbeslut ska requiresHumanDecision vara true och utkastet får inte påstå att beslutet redan är fattat.',
  'Be aldrig kunden lämna lösenord, kortuppgifter eller andra känsliga uppgifter.',
  'Skriv inte intern analys, systemtext eller policy till kunden.',
].join(' ');

export type AiArmanAdminReplyDraftInput = {
  caseId: string;
  caseType?: string;
  status?: string;
  statusLabel?: string;
  customerName?: string;
  messages?: Array<{
    direction?: string;
    sender?: string;
    subject?: string;
    text?: string;
    date?: string;
  }>;
};

@Injectable()
export class AiArmanAdminReplyDraftService {
  constructor(private readonly config: AiArmanAdminReplyDraftConfig) {}

  async createDraft(input: AiArmanAdminReplyDraftInput) {
    const config = this.config.read();
    if (!config.activationAllowed) throw new NotFoundException();

    const normalized = normalizeInput(input);
    if (!normalized) {
      return { ok: false as const, code: 'invalid_admin_reply_context' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(OPENAI_RESPONSES_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        redirect: 'error',
        signal: controller.signal,
        body: JSON.stringify({
          model: config.model,
          store: false,
          instructions: INSTRUCTIONS,
          input: JSON.stringify(normalized),
          max_output_tokens: 700,
          text: {
            format: {
              type: 'json_schema',
              name: 'ai_arman_admin_reply_draft',
              strict: true,
              schema: OUTPUT_SCHEMA,
            },
          },
        }),
      });

      if (!response.ok) {
        return {
          ok: false as const,
          code: 'admin_reply_model_http_error',
          providerHttpStatus: response.status,
        };
      }

      const body = (await response.json()) as unknown;
      const outputText = extractOutputText(body);
      const parsed = outputText ? JSON.parse(outputText) : null;
      const result = projectResult(parsed);
      return result
        ? {
            ok: true as const,
            draftText: result.draftText,
            requiresHumanDecision: result.requiresHumanDecision,
            decisionReasons: result.decisionReasons,
            confidence: result.confidence,
            sendsCustomerMessage: false,
            executesWrites: false,
          }
        : { ok: false as const, code: 'admin_reply_model_invalid' };
    } catch (error) {
      return {
        ok: false as const,
        code:
          error instanceof Error && error.name === 'AbortError'
            ? 'admin_reply_model_timeout'
            : 'admin_reply_model_request_failed',
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function normalizeInput(input: AiArmanAdminReplyDraftInput) {
  const caseId = clean(input?.caseId, 80);
  if (!caseId) return null;

  const messages = Array.isArray(input.messages)
    ? input.messages
        .slice(-MAX_CONTEXT_MESSAGES)
        .map((message) => ({
          direction: clean(message.direction, 20),
          sender: clean(message.sender, 80),
          subject: clean(message.subject, 300),
          text: clean(message.text, MAX_MESSAGE_LENGTH),
          date: clean(message.date, 64),
        }))
        .filter((message) => message.text || message.subject)
    : [];

  return {
    caseId,
    caseType: clean(input.caseType, 80),
    status: clean(input.status, 120),
    statusLabel: clean(input.statusLabel, 180),
    customerName: clean(input.customerName, 120),
    messages,
  };
}

function clean(value: unknown, maxLength: number): string {
  return String(value || '')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email_redacted]')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

function extractOutputText(body: unknown): string | null {
  if (!isRecord(body) || body.status !== 'completed' || !Array.isArray(body.output)) return null;
  const parts: string[] = [];
  for (const item of body.output) {
    if (!isRecord(item) || item.type !== 'message' || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (isRecord(content) && content.type === 'output_text' && typeof content.text === 'string') {
        parts.push(content.text);
      }
    }
  }
  return parts.join('').trim() || null;
}

function projectResult(value: unknown) {
  if (!isRecord(value)) return null;
  const rawDraftText = typeof value.draftText === 'string' ? value.draftText.trim() : '';
  const draftText = sanitizeDraftText(rawDraftText);
  const requiresHumanDecision = value.requiresHumanDecision;
  const decisionReasons = value.decisionReasons;
  const confidence = value.confidence;
  if (!draftText || draftText.length > MAX_DRAFT_LENGTH) return null;
  if (typeof requiresHumanDecision !== 'boolean') return null;
  if (!Array.isArray(decisionReasons) || decisionReasons.length > 6) return null;
  if (decisionReasons.some((reason) => typeof reason !== 'string' || !reason.trim() || reason.length > 160)) return null;
  if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) return null;
  return {
    draftText,
    requiresHumanDecision,
    decisionReasons: decisionReasons.map((reason) => reason.trim()),
    confidence,
  };
}

function sanitizeDraftText(value: string): string {
  let text = String(value || '').trim();

  text = text.replace(/^Hej(?:\s+[^\n,!]+)?[!,]?\s*(?:👋)?\s*\n*/i, '');
  text = text.replace(/^Hallå(?:\s+[^\n,!]+)?[!,]?\s*\n*/i, '');

  text = text.replace(/\n+\s*(?:Vänliga hälsningar|Med vänliga hälsningar|Varmt tack)[,!]?\s*(?:🤍)?\s*\n+\s*(?:HARMONIQ(?: Kundservice)?)\s*$/i, '');
  text = text.replace(/\n+\s*(?:HARMONIQ Kundservice|HARMONIQ)\s*$/i, '');

  return text.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
