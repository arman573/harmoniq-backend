import { Injectable } from '@nestjs/common';
import { AiArmanAdminCaseAssistantConfig } from './admin-case-assistant.config';
import { AiArmanAdminLearningStore } from './admin-learning.store';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const MAX_MESSAGES = 40;
const MAX_MESSAGE_TEXT = 3000;
const MAX_DISCUSSION_TEXT = 2000;

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    caseSummary: { type: 'string', minLength: 1, maxLength: 1200 },
    customerNeed: { type: 'string', minLength: 1, maxLength: 600 },
    recommendedActions: {
      type: 'array',
      maxItems: 6,
      items: { type: 'string', minLength: 1, maxLength: 500 },
    },
    reasoning: { type: 'string', minLength: 1, maxLength: 1600 },
    answerToAdmin: { type: 'string', minLength: 1, maxLength: 2500 },
    requiresHumanDecision: { type: 'boolean' },
    missingFacts: {
      type: 'array',
      maxItems: 8,
      items: { type: 'string', minLength: 1, maxLength: 300 },
    },
    learningCandidate: {
      type: ['object', 'null'],
      additionalProperties: false,
      properties: {
        principle: { type: 'string', minLength: 1, maxLength: 800 },
        appliesWhen: { type: 'string', minLength: 1, maxLength: 500 },
        avoid: { type: 'string', maxLength: 500 },
      },
      required: ['principle', 'appliesWhen', 'avoid'],
    },
  },
  required: [
    'caseSummary',
    'customerNeed',
    'recommendedActions',
    'reasoning',
    'answerToAdmin',
    'requiresHumanDecision',
    'missingFacts',
    'learningCandidate',
  ],
} as const;

@Injectable()
export class AiArmanAdminCaseAssistantService {
  constructor(
    private readonly config: AiArmanAdminCaseAssistantConfig,
    private readonly learning: AiArmanAdminLearningStore,
  ) {}

  async assist(input: unknown) {
    const config = this.config.read();
    if (!config.activationAllowed) {
      return { ok: false as const, code: 'admin_assistant_unavailable' };
    }

    const normalized = normalizeInput(input);
    if (!normalized) return { ok: false as const, code: 'invalid_case_context' };

    const lessons = await this.learning.listRelevant(normalized.caseType).catch(() => []);
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
          instructions: [
            'Du är AI Arman, intern ärendeassistent för HARMONIQ.',
            'Du ska hjälpa admin att förstå ett kundärende, resonera om säkra nästa steg och diskutera lösningar.',
            'Du får inte fatta eller påstå att HARMONIQ har fattat beslut om återbetalning, avslag, goodwill, ersättningsvara, juridik eller annan känslig affärsåtgärd.',
            'Använd endast fakta i ärendekontexten och godkända supportlärdomar.',
            'Om fakta saknas ska de listas under missingFacts i stället för att hittas på.',
            'answerToAdmin ska vara ett direkt svar till administratören, inte automatiskt kundutskick.',
            'learningCandidate ska bara föreslås när adminens diskussion innehåller en generaliserbar arbetsregel som kan vara värd att spara.',
          ].join(' '),
          input: JSON.stringify({ case: normalized, approvedLearnings: lessons }),
          max_output_tokens: 1600,
          text: {
            format: {
              type: 'json_schema',
              name: 'ai_arman_admin_case_assistant',
              strict: true,
              schema: OUTPUT_SCHEMA,
            },
          },
        }),
      });

      if (!response.ok) {
        return { ok: false as const, code: 'admin_assistant_model_unavailable', providerHttpStatus: response.status };
      }
      const body = await response.json() as unknown;
      const text = extractOutputText(body);
      const parsed = text ? JSON.parse(text) : null;
      const result = projectResult(parsed);
      return result
        ? { ok: true as const, ...result, approvedLearningsUsed: lessons.length, sendsCustomerMessage: false, executesWrites: false }
        : { ok: false as const, code: 'admin_assistant_model_invalid' };
    } catch (error) {
      return {
        ok: false as const,
        code: error instanceof Error && error.name === 'AbortError'
          ? 'admin_assistant_timeout'
          : 'admin_assistant_model_unavailable',
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async approveLearning(input: unknown) {
    const config = this.config.read();
    if (!config.learningEnabled) return { ok: false as const, code: 'admin_learning_disabled' };
    if (!isRecord(input) || input.approved !== true) {
      return { ok: false as const, code: 'admin_learning_requires_approval' };
    }
    const principle = clean(input.principle, 800);
    const appliesWhen = clean(input.appliesWhen, 500);
    const avoid = clean(input.avoid, 500);
    const createdBy = clean(input.createdBy, 120);
    const caseType = clean(input.caseType, 80).toLowerCase();
    if (!principle || !createdBy) return { ok: false as const, code: 'invalid_admin_learning' };

    try {
      const lesson = await this.learning.save({ principle, appliesWhen, avoid, createdBy, caseType });
      return { ok: true as const, lessonId: lesson.id, createdAt: lesson.createdAt };
    } catch (error) {
      return {
        ok: false as const,
        code: error instanceof Error ? error.message : 'admin_learning_save_failed',
      };
    }
  }
}

function normalizeInput(value: unknown) {
  if (!isRecord(value)) return null;
  const caseId = clean(value.caseId, 100);
  const caseType = clean(value.caseType, 80).toLowerCase();
  const status = clean(value.status, 120);
  const adminQuestion = clean(value.adminQuestion, MAX_DISCUSSION_TEXT);
  const messages = Array.isArray(value.messages)
    ? value.messages.slice(-MAX_MESSAGES).filter(isRecord).map((message) => ({
        direction: clean(message.direction, 20),
        sender: clean(message.sender, 80),
        subject: clean(message.subject, 500),
        text: clean(message.text, MAX_MESSAGE_TEXT),
        date: clean(message.date, 64),
      })).filter((message) => message.text || message.subject)
    : [];
  if (!caseId || !caseType) return null;
  return {
    caseId,
    caseType,
    status,
    customerName: clean(value.customerName, 100),
    adminQuestion,
    messages,
  };
}

function projectResult(value: unknown) {
  if (!isRecord(value)) return null;
  const caseSummary = clean(value.caseSummary, 1200);
  const customerNeed = clean(value.customerNeed, 600);
  const recommendedActions = readStringArray(value.recommendedActions, 6, 500);
  const reasoning = clean(value.reasoning, 1600);
  const answerToAdmin = clean(value.answerToAdmin, 2500);
  const missingFacts = readStringArray(value.missingFacts, 8, 300);
  const requiresHumanDecision = value.requiresHumanDecision;
  const learningCandidate = value.learningCandidate === null
    ? null
    : isRecord(value.learningCandidate)
      ? {
          principle: clean(value.learningCandidate.principle, 800),
          appliesWhen: clean(value.learningCandidate.appliesWhen, 500),
          avoid: clean(value.learningCandidate.avoid, 500),
        }
      : undefined;

  if (!caseSummary || !customerNeed || !recommendedActions || !reasoning || !answerToAdmin || !missingFacts) return null;
  if (typeof requiresHumanDecision !== 'boolean' || learningCandidate === undefined) return null;
  if (learningCandidate && !learningCandidate.principle) return null;
  return { caseSummary, customerNeed, recommendedActions, reasoning, answerToAdmin, missingFacts, requiresHumanDecision, learningCandidate };
}

function readStringArray(value: unknown, maxItems: number, maxLength: number): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const result: string[] = [];
  for (const item of value) {
    const cleaned = clean(item, maxLength);
    if (!cleaned) return null;
    result.push(cleaned);
  }
  return result;
}

function extractOutputText(body: unknown): string | null {
  if (!isRecord(body) || body.status !== 'completed' || !Array.isArray(body.output)) return null;
  const parts: string[] = [];
  for (const item of body.output) {
    if (!isRecord(item) || item.type !== 'message' || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (isRecord(content) && content.type === 'output_text' && typeof content.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('').trim() || null;
}

function clean(value: unknown, max: number): string {
  return String(value || '')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email_redacted]')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
