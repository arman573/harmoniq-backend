import { Injectable } from '@nestjs/common';
import { AiArmanAdminCaseAssistantConfig } from './admin-case-assistant.config';
import { AiArmanAdminLearningStore } from './admin-learning.store';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const MAX_MESSAGES = 40;
const MAX_MESSAGE_TEXT = 3000;
const MAX_DISCUSSION_TURNS = 12;
const MAX_DISCUSSION_TEXT = 1200;

const REPLY_DRAFT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    draftText: { type: 'string', minLength: 1, maxLength: 1800 },
    requiresHumanDecision: { type: 'boolean' },
    decisionReasons: {
      type: 'array',
      maxItems: 4,
      items: { type: 'string', minLength: 1, maxLength: 160 },
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['draftText', 'requiresHumanDecision', 'decisionReasons', 'confidence'],
} as const;

const ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    caseSummary: { type: 'string', minLength: 1, maxLength: 420 },
    customerNeed: { type: 'string', minLength: 1, maxLength: 240 },
    recommendedActions: {
      type: 'array',
      maxItems: 3,
      items: { type: 'string', minLength: 1, maxLength: 180 },
    },
    reasoning: { type: 'string', minLength: 1, maxLength: 420 },
    requiresHumanDecision: { type: 'boolean' },
    missingFacts: {
      type: 'array',
      maxItems: 4,
      items: { type: 'string', minLength: 1, maxLength: 140 },
    },
    replyDraft: REPLY_DRAFT_SCHEMA,
  },
  required: [
    'caseSummary',
    'customerNeed',
    'recommendedActions',
    'reasoning',
    'requiresHumanDecision',
    'missingFacts',
    'replyDraft',
  ],
} as const;

const DISCUSSION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    answerToAdmin: { type: 'string', minLength: 1, maxLength: 1200 },
    requiresHumanDecision: { type: 'boolean' },
    learningCandidate: {
      type: ['object', 'null'],
      additionalProperties: false,
      properties: {
        principle: { type: 'string', minLength: 1, maxLength: 600 },
        appliesWhen: { type: 'string', minLength: 1, maxLength: 400 },
        avoid: { type: 'string', maxLength: 400 },
      },
      required: ['principle', 'appliesWhen', 'avoid'],
    },
  },
  required: ['answerToAdmin', 'requiresHumanDecision', 'learningCandidate'],
} as const;

@Injectable()
export class AiArmanAdminCaseAssistantFastService {
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
    return normalized.adminQuestion
      ? this.discuss(normalized, lessons, config)
      : this.analyze(normalized, lessons, config);
  }

  private async analyze(
    normalized: NormalizedInput,
    lessons: unknown[],
    config: ReturnType<AiArmanAdminCaseAssistantConfig['read']>,
  ) {
    const modelResult = await this.callModel({
      config,
      schemaName: 'ai_arman_admin_case_analysis',
      schema: ANALYSIS_SCHEMA,
      maxOutputTokens: 650,
      instructions: [
        'Du är AI Arman, intern ärendeassistent för HARMONIQ.',
        'Gör en enda snabb analys som både hjälper admin förstå ärendet och ger ett färdigt kundsvar. Undvik dubbelarbete.',
        'Analysera kort och konkret för en smal adminpanel: kundens faktiska behov, säkra nästa steg och verifierade fakta som saknas.',
        'ReplyDraft ska låta som Arman själv skriver till kunden: varm, go, mänsklig, rak, personlig och lite talspråklig. Det ska kännas som att en riktig person hjälper någon man bryr sig om, inte som ett kundservice-manus.',
        'Använd gärna jag-form när det känns naturligt: "jag hjälper dig", "jag kollar det", "det löser vi". Undvik opersonligt myndighets- eller företagspråk.',
        'Arman kan kalla kunden "vännen" eller "bästa", men naturligt och sparsamt, normalt högst en gång per svar och inte mekaniskt i varje svar.',
        'Skriv kort: normalt 2-4 korta meningar. En varm emoji som 🤍, 🙏 eller 🫶 får användas när det passar, normalt högst en eller två.',
        'Om kunden berättar att problemet redan löst sig ska du inte skapa en ny onödig fråga. Bekräfta varmt och avsluta naturligt.',
        'Stilnivå, inte faktamallar: "Åh vad skönt vännen att det löste sig 🤍 Då behöver vi inte göra något mer. Ha en superfin resa!" eller "Självklart bästa, jag kollar det åt dig 🤍".',
        'Skriv endast själva brödtexten i replyDraft. Mailmotorn äger hälsning och signatur.',
        'Skriv därför ALDRIG Hej, Hallå, Tjena eller kundnamn som inledande hälsning. Skriv ALDRIG Mvh, MVH, Vänliga hälsningar, Med vänlig hälsning, Med vänliga hälsningar, Varma hälsningar, Bästa hälsningar, Varmt tack, HARMONIQ, HARMONIQ Kundservice eller annan signatur/footer.',
        'Undvik generiska kundservicefraser som "tack för att du kontaktar oss", "vi beklagar eventuella olägenheter", "vänligen", "hör av dig så hjälper vi dig vidare" och "återkom gärna om du har fler frågor" när du kan säga samma sak mer mänskligt och direkt.',
        'Lägg inte till generiska avslutningsfraser som Trevlig helg, Ha en fin dag eller Trevlig resa om kundens meddelande inte ger en naturlig anledning till just den frasen.',
        'Fatta aldrig beslut om återbetalning, avslag, goodwill, ersättningsvara, juridik eller annan känslig affärsåtgärd.',
        'Om ett sådant beslut krävs ska både analysens requiresHumanDecision och replyDraft.requiresHumanDecision vara true, och replyDraft får inte påstå att beslutet redan är fattat.',
        'Använd endast fakta i ärendekontexten och godkända supportlärdomar. Hitta aldrig på pris, lager, orderstatus, tracking, returutfall eller andra fakta.',
      ].join(' '),
      payload: { case: normalized, approvedLearnings: lessons },
    });
    if (!modelResult.ok) return modelResult;

    const projected = projectAnalysis(modelResult.value);
    return projected
      ? {
          ok: true as const,
          mode: 'analysis' as const,
          ...projected,
          approvedLearningsUsed: lessons.length,
          sendsCustomerMessage: false,
          executesWrites: false,
        }
      : { ok: false as const, code: 'admin_assistant_model_invalid' };
  }

  private async discuss(
    normalized: NormalizedInput,
    lessons: unknown[],
    config: ReturnType<AiArmanAdminCaseAssistantConfig['read']>,
  ) {
    const modelResult = await this.callModel({
      config,
      schemaName: 'ai_arman_admin_case_discussion',
      schema: DISCUSSION_SCHEMA,
      maxOutputTokens: 650,
      instructions: [
        'Du är AI Arman, intern diskussionspartner för HARMONIQ admin.',
        'Besvara administratörens fråga direkt, kort och konkret med hänsyn till tidigare diskussion.',
        'Använd endast fakta i ärendet, tidigare diskussion och godkända supportlärdomar.',
        'Om ett förslag kräver återbetalning, avslag, goodwill, ersättningsvara, juridik eller annat känsligt affärsbeslut ska requiresHumanDecision vara true och du får inte påstå att beslutet är fattat.',
        'learningCandidate får endast föreslås om admin uttryckt en generaliserbar arbetsregel som kan vara värd att spara efter separat godkännande.',
        'Detta är ett svar till admin, aldrig ett automatiskt kundutskick.',
      ].join(' '),
      payload: { case: normalized, approvedLearnings: lessons },
    });
    if (!modelResult.ok) return modelResult;

    const projected = projectDiscussion(modelResult.value);
    return projected
      ? {
          ok: true as const,
          mode: 'discussion' as const,
          ...projected,
          approvedLearningsUsed: lessons.length,
          sendsCustomerMessage: false,
          executesWrites: false,
        }
      : { ok: false as const, code: 'admin_assistant_model_invalid' };
  }

  private async callModel(input: {
    config: ReturnType<AiArmanAdminCaseAssistantConfig['read']>;
    schemaName: string;
    schema: typeof ANALYSIS_SCHEMA | typeof DISCUSSION_SCHEMA;
    maxOutputTokens: number;
    instructions: string;
    payload: unknown;
  }): Promise<{ ok: true; value: unknown } | { ok: false; code: string; providerHttpStatus?: number }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.config.timeoutMs);

    try {
      const response = await fetch(OPENAI_RESPONSES_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${input.config.apiKey}`,
        },
        redirect: 'error',
        signal: controller.signal,
        body: JSON.stringify({
          model: input.config.model,
          store: false,
          reasoning: { effort: 'minimal' },
          instructions: input.instructions,
          input: JSON.stringify(input.payload),
          max_output_tokens: input.maxOutputTokens,
          text: {
            format: {
              type: 'json_schema',
              name: input.schemaName,
              strict: true,
              schema: input.schema,
            },
          },
        }),
      });

      if (!response.ok) {
        return {
          ok: false,
          code: 'admin_assistant_model_unavailable',
          providerHttpStatus: response.status,
        };
      }
      const body = (await response.json()) as unknown;
      const outputText = extractOutputText(body);
      return outputText
        ? { ok: true, value: JSON.parse(outputText) as unknown }
        : { ok: false, code: 'admin_assistant_model_invalid' };
    } catch (error) {
      return {
        ok: false,
        code:
          error instanceof Error && error.name === 'AbortError'
            ? 'admin_assistant_timeout'
            : 'admin_assistant_model_unavailable',
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

type NormalizedInput = ReturnType<typeof normalizeInput> extends infer T
  ? Exclude<T, null>
  : never;

function normalizeInput(value: unknown) {
  if (!isRecord(value)) return null;
  const caseId = clean(value.caseId, 100);
  const caseType = clean(value.caseType, 80).toLowerCase();
  if (!caseId || !caseType) return null;

  const messages = Array.isArray(value.messages)
    ? value.messages
        .slice(-MAX_MESSAGES)
        .filter(isRecord)
        .map((message) => ({
          direction: clean(message.direction, 20),
          sender: clean(message.sender, 80),
          subject: clean(message.subject, 500),
          text: clean(message.text, MAX_MESSAGE_TEXT),
          date: clean(message.date, 64),
        }))
        .filter((message) => message.text || message.subject)
    : [];

  const discussion = Array.isArray(value.discussion)
    ? value.disussion
        .slice(-MAX_DISCUSSION_TURNS)
        .filter(isRecord)
        .map((turn) => ({
          role:
            String(turn.role || '').toLowerCase() === 'assistant'
              ? 'assistant'
              : 'admin',
          text: clean(turn.text, MAX_DISCUSSION_TEXT),
        }))
        .filter((turn) => turn.text)
    : [];

  return {
    caseId,
    caseType,
    status: clean(value.status, 120),
    customerName: clean(value.customerName, 100),
    adminQuestion: clean(value.adminQuestion, MAX_DISCUSSION_TEXT),
    messages,
    discussion,
  };
}

function projectAnalysis(value: unknown) {
  if (!isRecord(value)) return null;
  const caseSummary = clean(value.caseSummary, 420);
  const customerNeed = clean(value.customerNeed, 240);
  const recommendedActions = readStringArray(value.recommendedActions, 3, 180);
  const reasoning = clean(value.reasoning, 420);
  const missingFacts = readStringArray(value.missingFacts, 4, 140);
  const replyDraft = projectReplyDraft(value.replyDraft);
  if (
    !caseSummary ||
    !customerNeed ||
    !recommendedActions ||
    !reasoning ||
    !missingFacts ||
    !replyDraft ||
    typeof value.requiresHumanDecision !== 'boolean'
  ) {
    return null;
  }
  return {
    caseSummary,
    customerNeed,
    recommendedActions,
    reasoning,
    requiresHumanDecision: value.requiresHumanDecision,
    missingFacts,
    replyDraft,
  };
}

function projectReplyDraft(value: unknown) {
  if (!isRecord(value)) return null;
  const draftText = stripMailWrapper(cleanDraftText(value.draftText, 1800));
  const decisionReasons = readStringArray(value.decisionReasons, 4, 160);
  const confidence = value.confidence;
  if (
    !draftText ||
    !decisionReasons ||
    typeof value.requiresHumanDecision !== 'boolean' ||
    typeof confidence !== 'number' ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1
  ) {
    return null;
  }
  return {
    draftText,
    requiresHumanDecision: value.requiresHumanDecision,
    decisionReasons,
    confidence,
  };
}

function stripMailWrapper(value: string): string {
  let text = String(value || '').trim();

  text = text.replace(
    /^(?:Hej|Hallå|Tjena)(?:\s+[^\n,!?.]{1,80})?[!,]?\s*(?:👋|🤍|🫶)?\s*/i,
    '',
  );

  const trailingSignoff = /\s+(?:Mvh|MVH|Vänliga hälsningar|Med vänlig hälsning|Med vänliga hälsningar|Varma hälsningar|Bästa hälsningar|Varmt tack)[,!]?\s*(?:🤍|🫶)?\s*(?:(?:HARMONIQ(?: Kundservice)?)|(?:Arman(?:\s*[-–—]\s*HARMONIQ)?))?\s*$/i;
  text = text.replace(trailingSignoff, '');
  text = text.replace(/\s+(?:HARMONIQ Kundservice|HARMONIQ)\s*$/i, '');

  return text.trim();
}

function projectDiscussion(value: unknown) {
  if (!isRecord(value)) return null;
  const answerToAdmin = clean(value.answerToAdmin, 1200);
  const learningCandidate =
    value.learningCandidate === null
      ? null
      : isRecord(value.learningCandidate)
        ? {
            principle: clean(value.learningCandidate.principle, 600),
            appliesWhen: clean(value.learningCandidate.appliesWhen, 400),
            avoid: clean(value.learningCandidate.avoid, 400),
          }
        : undefined;
  if (
    !answerToAdmin ||
    typeof value.requiresHumanDecision !== 'boolean' ||
    learningCandidate === undefined ||
    (learningCandidate !== null && !learningCandidate.principle)
  ) {
    return null;
  }
  return {
    answerToAdmin,
    requiresHumanDecision: value.requiresHumanDecision,
    learningCandidate,
  };
}

function readStringArray(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const result: string[] = [];
  for (const item of value) {
    const normalized = clean(item, maxLength);
    if (!normalized) return null;
    result.push(normalized);
  }
  return result;
}

function extractOutputText(body: unknown): string | null {
  if (!isRecord(body) || body.status !== 'completed' || !Array.isArray(body.output)) {
    return null;
  }
  const parts: string[] = [];
  for (const item of body.output) {
    if (!isRecord(item) || item.type !== 'message' || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (
        isRecord(content) &&
        content.type === 'output_text' &&
        typeof content.text === 'string'
      ) {
        parts.push(content.text);
      }
    }
  }
  return parts.join('').trim() || null;
}

function cleanDraftText(value: unknown, max: number): string {
  return String(value || '')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email_redacted]')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
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
