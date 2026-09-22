import { Injectable } from '@nestjs/common';

export interface MailAgentWorkstylePreview {
  summary: string;
  scope: {
    mailboxes: string[];
  };
  conditions: {
    senders: string[];
    subjectTerms: string[];
    bodyTerms: string[];
    categories: string[];
    paymentState: 'any' | 'paid_only' | 'unpaid_only';
  };
  actions: {
    category: string;
    priority: string;
    routeTo: string;
    forwardTo: string[];
    neverAutoArchive: boolean;
    followUpAfterDays: number | null;
    suppressIfNormal: boolean;
    requireHumanApproval: boolean;
  };
  warnings: string[];
}

@Injectable()
export class MailAgentGptHelpService {
  async preview(instruction: string): Promise<{
    ok: boolean;
    code?: string;
    error?: string;
    model?: string;
    preview?: MailAgentWorkstylePreview;
  }> {
    const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
    const model = String(
      process.env.MAIL_AGENT_GPT_MODEL || process.env.OPENAI_MODEL || '',
    ).trim();

    if (!apiKey || !model) {
      return {
        ok: false,
        code: 'mail_agent_gpt_not_configured',
        error:
          'GPT-hjälpen saknar OPENAI_API_KEY eller MAIL_AGENT_GPT_MODEL i runtime.',
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          reasoning: { effort: 'low' },
          instructions: buildSystemInstruction(),
          input: instruction,
          text: {
            format: {
              type: 'json_schema',
              name: 'harmoniq_mail_workstyle_preview',
              strict: true,
              schema: buildSchema(),
            },
          },
        }),
        signal: controller.signal,
      });

      const data = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;

      if (!response.ok) {
        return {
          ok: false,
          code: 'mail_agent_gpt_request_failed',
          error: getApiError(data) || `GPT-hjälpen svarade med HTTP ${response.status}.`,
        };
      }

      const text = extractOutputText(data);
      if (!text) {
        return {
          ok: false,
          code: 'mail_agent_gpt_empty_output',
          error: 'GPT-hjälpen returnerade ingen strukturerad tolkning.',
        };
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        return {
          ok: false,
          code: 'mail_agent_gpt_invalid_json',
          error: 'GPT-hjälpens strukturerade svar kunde inte läsas.',
        };
      }

      const validated = validatePreview(parsed);
      if (!validated.ok) {
        return {
          ok: false,
          code: 'mail_agent_gpt_invalid_preview',
          error: validated.error,
        };
      }

      return {
        ok: true,
        model,
        preview: validated.value,
      };
    } catch (error) {
      return {
        ok: false,
        code:
          (error as { name?: string })?.name === 'AbortError'
            ? 'mail_agent_gpt_timeout'
            : 'mail_agent_gpt_failed',
        error:
          (error as { name?: string })?.name === 'AbortError'
            ? 'GPT-hjälpen svarade inte inom tidsgränsen.'
            : 'GPT-hjälpen kunde inte tolka instruktionen just nu.',
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function buildSystemInstruction() {
  return [
    'Du tolkar svenska eller engelska admininstruktioner för HARMONIQs mailagent.',
    'Din uppgift är endast att skapa en strukturerad preview av ett arbetssätt.',
    'Du får aldrig utföra åtgärden själv.',
    'Hitta inte på avsändare, mailboxar, mottagare, e-postadresser eller tidsgränser som inte uttryckligen framgår.',
    'Tillåtna mailboxar är arman@harmoniq.se, inkop@harmoniq.se och ekonomi@harmoniq.se.',
    'Om instruktionen handlar om kvitto eller underlag som redan betalats, använd paymentState=paid_only.',
    'En vanlig faktura är inte samma sak som ett betalt underlag.',
    'Om en instruktion kan skicka eller vidarebefordra mail, påverka ekonomi, avtal, säkerhet eller kundärenden ska requireHumanApproval normalt vara true.',
    'neverAutoArchive ska vara true för fakturor, betalningar, påminnelser, inkasso, avtal och säkerhetsärenden.',
    'warnings ska tydligt beskriva oklarheter som kräver mänskligt beslut.',
    'Svara endast enligt JSON-schemat.',
  ].join('\n');
}

function buildSchema() {
  const categories = [
    '',
    'customer_service',
    'returns_claims',
    'supplier',
    'invoice_finance',
    'order_purchase',
    'marketing_ads',
    'compliance_legal',
    'system_alert',
    'calendar_training',
    'newsletter_promo',
    'personal',
    'unknown',
  ];

  return {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'scope', 'conditions', 'actions', 'warnings'],
    properties: {
      summary: { type: 'string', minLength: 1, maxLength: 800 },
      scope: {
        type: 'object',
        additionalProperties: false,
        required: ['mailboxes'],
        properties: {
          mailboxes: {
            type: 'array',
            maxItems: 3,
            items: {
              type: 'string',
              enum: [
                'arman@harmoniq.se',
                'inkop@harmoniq.se',
                'ekonomi@harmoniq.se',
              ],
            },
          },
        },
      },
      conditions: {
        type: 'object',
        additionalProperties: false,
        required: [
          'senders',
          'subjectTerms',
          'bodyTerms',
          'categories',
          'paymentState',
        ],
        properties: {
          senders: {
            type: 'array',
            maxItems: 30,
            items: { type: 'string', maxLength: 320 },
          },
          subjectTerms: {
            type: 'array',
            maxItems: 30,
            items: { type: 'string', maxLength: 200 },
          },
          bodyTerms: {
            type: 'array',
            maxItems: 30,
            items: { type: 'string', maxLength: 200 },
          },
          categories: {
            type: 'array',
            maxItems: 12,
            items: { type: 'string', enum: categories },
          },
          paymentState: {
            type: 'string',
            enum: ['any', 'paid_only', 'unpaid_only'],
          },
        },
      },
      actions: {
        type: 'object',
        additionalProperties: false,
        required: [
          'category',
          'priority',
          'routeTo',
          'forwardTo',
          'neverAutoArchive',
          'followUpAfterDays',
          'suppressIfNormal',
          'requireHumanApproval',
        ],
        properties: {
          category: { type: 'string', enum: categories },
          priority: {
            type: 'string',
            enum: ['', 'critical', 'high', 'normal', 'low'],
          },
          routeTo: {
            type: 'string',
            enum: [
              '',
              'finance',
              'supplier-ops',
              'marketing',
              'returns-module',
              'general',
              'none',
            ],
          },
          forwardTo: {
            type: 'array',
            maxItems: 20,
            items: { type: 'string', maxLength: 320 },
          },
          neverAutoArchive: { type: 'boolean' },
          followUpAfterDays: {
            anyOf: [
              { type: 'integer', minimum: 1, maximum: 365 },
              { type: 'null' },
            ],
          },
          suppressIfNormal: { type: 'boolean' },
          requireHumanApproval: { type: 'boolean' },
        },
      },
      warnings: {
        type: 'array',
        maxItems: 20,
        items: { type: 'string', maxLength: 500 },
      },
    },
  };
}

function extractOutputText(data: Record<string, unknown>) {
  const direct = data.output_text;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();

  const output = Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = Array.isArray((item as { content?: unknown[] }).content)
      ? (item as { content: unknown[] }).content
      : [];

    for (const part of content) {
      if (!part || typeof part !== 'object') continue;
      const value = (part as { text?: unknown }).text;
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }

  return '';
}

function getApiError(data: Record<string, unknown>) {
  const error = data.error;
  if (!error || typeof error !== 'object') return '';
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : '';
}

function validatePreview(
  value: unknown,
):
  | { ok: true; value: MailAgentWorkstylePreview }
  | { ok: false; error: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'GPT-preview är inte ett objekt.' };
  }

  const item = value as MailAgentWorkstylePreview;
  if (!String(item.summary || '').trim()) {
    return { ok: false, error: 'GPT-preview saknar sammanfattning.' };
  }

  const allowedMailboxes = new Set([
    'arman@harmoniq.se',
    'inkop@harmoniq.se',
    'ekonomi@harmoniq.se',
  ]);

  for (const mailbox of item.scope?.mailboxes || []) {
    if (!allowedMailboxes.has(mailbox)) {
      return { ok: false, error: 'GPT-preview innehåller en otillåten mailbox.' };
    }
  }

  for (const email of item.actions?.forwardTo || []) {
    if (!isEmail(email)) {
      return { ok: false, error: 'GPT-preview innehåller en ogiltig e-postadress.' };
    }
  }

  return { ok: true, value: item };
}

function isEmail(value: string) {
  const email = String(value || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320;
}
