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
        draftText: 'Åh vad skönt vännen att det löste sig 🤍 Då behöver vi inte göra något mer. Ha en superfin resa!',
      },
    });
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
