import { AiArmanAdminCaseAssistantConfig } from './admin-case-assistant.config';
import { AiArmanAdminCaseAssistantFastService } from './admin-case-assistant-fast.service';
import type { AiArmanAdminLearningStore } from './admin-learning.store';

describe('AiArmanAdminCaseAssistantFastService', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it('returns analysis and customer draft in one minimal-reasoning model call', async () => {
    enableAssistant();
    const learning = learningStore();
    const fetchMock = jest.fn(async (_url, init) => {
      const request = JSON.parse(String(init?.body || '{}'));
      expect(request.reasoning).toEqual({ effort: 'minimal' });
      expect(request.max_output_tokens).toBe(650);
      expect(request.text.format.name).toBe('ai_arman_admin_case_analysis');
      expect(request.text.format.schema.properties).toHaveProperty('replyDraft');
      expect(request.text.format.schema.properties).not.toHaveProperty('answerToAdmin');
      expect(request.instructions).toContain('låta som Arman själv skriver');
      expect(request.instructions).toContain('ALDRIG Mvh');
      return modelResponse({
        caseSummary: 'Kunden saknar tracking.',
        customerNeed: 'Verifierad leveransinformation.',
        recommendedActions: ['Kontrollera faktisk fraktstatus.'],
        reasoning: 'Tracking måste verifieras innan den kommuniceras.',
        requiresHumanDecision: false,
        missingFacts: ['Verifierad fraktstatus'],
        replyDraft: {
          draftText: 'Hej Anna! Självklart vännen, jag hjälper dig att reda ut det här 🤍',
          requiresHumanDecision: false,
          decisionReasons: [],
          confidence: 0.92,
        },
      });
    });
    global.fetch = fetchMock as typeof fetch;

    const service = new AiArmanAdminCaseAssistantFastService(new AiArmanAdminCaseAssistantConfig(), learning);
    await expect(service.assist({
      caseId: 'HQR-123',
      caseType: 'support',
      messages: [{ direction: 'inbound', text: 'Var är min tracking?' }],
    })).resolves.toMatchObject({
      ok: true,
      mode: 'analysis',
      sendsCustomerMessage: false,
      executesWrites: false,
      replyDraft: {
        draftText: 'Självklart vännen, jag hjälper dig att reda ut det här 🤍',
        requiresHumanDecision: false,
        confidence: 0.92,
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('removes greeting and legacy signature even when the model returns the full old mail wrapper', async () => {
    enableAssistant();
    const learning = learningStore();
    global.fetch = jest.fn(async () => modelResponse({
      caseSummary: 'Kunden meddelar att paketet nu går att hämta.',
      customerNeed: 'Ingen ytterligare åtgärd behövs.',
      recommendedActions: ['Bekräfta varmt att det löst sig.'],
      reasoning: 'Kunden säger själv att problemet är löst.',
      requiresHumanDecision: false,
      missingFacts: [],
      replyDraft: {
        draftText: 'Hej,\n\nÅh vad skönt vännen att det löste sig 🤍 Då behöver vi inte göra något mer. Ha en superfin resa!\n\nMvh,\nHARMONIQ Kundservice',
        requiresHumanDecision: false,
        decisionReasons: [],
        confidence: 0.96,
      },
    })) as typeof fetch;

    const service = new AiArmanAdminCaseAssistantFastService(new AiArmanAdminCaseAssistantConfig(), learning);
    await expect(service.assist({
      caseId: 'HQR-2494077',
      caseType: 'support',
      messages: [{ direction: 'inbound', text: 'Jag fick precis meddelande att jag kan hämta paketet. Tack så mycket! Jag ska resa tidigt på måndag.' }],
    })).resolves.toMatchObject({
      ok: true,
      replyDraft: {
        draftText: 'Åh vad skönt vännen att det löste sig 🤍 Ha en superfin resa! 🫶',
      },
    });
  });

  it('does not reopen an old tracking need after the latest customer message confirms collection is available', async () => {
    enableAssistant();
    const learning = learningStore();
    const fetchMock = jest.fn(async (_url, init) => {
      const request = JSON.parse(String(init?.body || '{}'));
      expect(request.input).toContain('latestCustomerMessage');
      expect(request.input).toContain('latestCustomerMessageClosesPreviousNeed');
      expect(request.input).toContain('Jag fick precis ett meddelande om att jag kan hämta det från utlämningsstället.');

      return modelResponse({
        caseSummary: 'Kunden har tidigare efterfrågat sändnings-ID.',
        customerNeed: 'Skicka sändnings-ID.',
        recommendedActions: [
          'Skicka sändnings-ID.',
          'Informera om öppettider på utlämningsstället.',
        ],
        reasoning: 'Det fanns en tidigare fråga om tracking.',
        requiresHumanDecision: false,
        missingFacts: ['Öppettider'],
        replyDraft: {
          draftText: 'Behöver du fortfarande sändnings-ID så ordnar jag det, och jag kan även hjälpa med öppettider.',
          requiresHumanDecision: false,
          decisionReasons: [],
          confidence: 0.91,
        },
      });
    });
    global.fetch = fetchMock as typeof fetch;

    const service = new AiArmanAdminCaseAssistantFastService(new AiArmanAdminCaseAssistantConfig(), learning);
    const result = await service.assist({
      caseId: 'HQR-2494077',
      caseType: 'support',
      messages: [
        {
          direction: 'inbound',
          sender: 'Kund',
          date: '2026-08-19T20:18:00+02:00',
          text: 'Hej, kan jag få Sändnings-ID?',
        },
        {
          direction: 'inbound',
          sender: 'Kund',
          date: '2026-08-21T13:09:00+02:00',
          text: 'Jag får ingenting, så jag tror att jag vill inte ha den, jag reser på måndag.',
        },
        {
          direction: 'inbound',
          sender: 'Kund',
          date: '2026-08-21T13:19:00+02:00',
          text: 'Jag ber verkligen om ursäkt! Jag fick precis ett meddelande om att jag kan hämta det från utlämningsstället. Tack så mycket för den snabba leveransen, och ursäkta igen att jag hade så bråttom. Jag ska resa tidigt på måndag morgon.',
        },
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      mode: 'analysis',
      customerNeed: 'Kunden bekräftar att det tidigare problemet är löst och efterfrågar ingen ny åtgärd.',
      recommendedActions: ['Bekräfta varmt att det löste sig och återöppna inte tidigare frågor.'],
      missingFacts: [],
      replyDraft: {
        draftText: 'Åh vad skönt vännen att det löste sig 🤍 Du behöver verkligen inte be om ursäkt, jag fattar att det blev stressigt. Ha en superfin resa! 🫶',
      },
    });
    if (!result || result.ok !== true || result.mode !== 'analysis') {
      throw new Error('Expected successful analysis result');
    }
    expect(result.customerNeed).not.toMatch(/sändnings-id|öppettider/i);
    expect(result.recommendedActions.join(' ')).not.toMatch(/sändnings-id|öppettider/i);
    expect(result.replyDraft.draftText).not.toMatch(/sändnings-id|öppettider/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses a separate compact schema and prior turns for discussion', async () => {
    enableAssistant();
    const learning = learningStore();
    global.fetch = jest.fn(async (_url, init) => {
      const request = JSON.parse(String(init?.body || '{}'));
      expect(request.reasoning).toEqual({ effort: 'minimal' });
      expect(request.max_output_tokens).toBe(650);
      expect(request.text.format.name).toBe('ai_arman_admin_case_discussion');
      expect(request.input).toContain('Vi brukar kontrollera transportören först.');
      expect(request.text.format.schema.properties).not.toHaveProperty('caseSummary');
      return modelResponse({
        answerToAdmin: 'Då bör transportörens faktiska status kontrolleras först.',
        requiresHumanDecision: false,
        learningCandidate: {
          principle: 'Kontrollera transportören först när tracking saknas.',
          appliesWhen: 'Tracking saknas.',
          avoid: 'Lova leverans innan status är verifierad.',
        },
      });
    }) as typeof fetch;

    const service = new AiArmanAdminCaseAssistantFastService(new AiArmanAdminCaseAssistantConfig(), learning);
    await expect(service.assist({
      caseId: 'HQR-123',
      caseType: 'support',
      adminQuestion: 'Vad gör vi först?',
      discussion: [{ role: 'admin', text: 'Vi brukar kontrollera transportören först.' }],
      messages: [{ direction: 'inbound', text: 'Var är min tracking?' }],
    })).resolves.toMatchObject({
      ok: true,
      mode: 'discussion',
      sendsCustomerMessage: false,
      executesWrites: false,
      answerToAdmin: 'Då bör transportörens faktiska status kontrolleras först.',
    });
  });
});

function enableAssistant() {
  process.env.AI_ARMAN_ADMIN_ASSISTANT_ENABLED = 'true';
  process.env.AI_ARMAN_MODEL_INTERPRETATION_ENABLED = 'true';
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.AI_ARMAN_OPENAI_MODEL = 'gpt-5-mini';
  process.env.AI_ARMAN_MODEL_INPUT_COST_USD_PER_MILLION_TOKENS = '0.25';
  process.env.AI_ARMAN_MODEL_OUTPUT_COST_USD_PER_MILLION_TOKENS = '2';
  process.env.AI_ARMAN_ADMIN_ASSISTANT_TIMEOUT_MS = '20000';
}

function learningStore() {
  return {
    listRelevant: jest.fn().mockResolvedValue([]),
    save: jest.fn(),
  } as unknown as AiArmanAdminLearningStore;
}

function modelResponse(value: unknown) {
  return new Response(JSON.stringify({
    status: 'completed',
    output: [{
      type: 'message',
      content: [{ type: 'output_text', text: JSON.stringify(value) }],
    }],
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}
