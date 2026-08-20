import { AiArmanAdminCaseAssistantConfig } from './admin-case-assistant.config';
import { AiArmanAdminCaseAssistantService } from './admin-case-assistant.service';
import type { AiArmanAdminLearningStore } from './admin-learning.store';

describe('AiArmanAdminCaseAssistantService', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('returns a read-only admin analysis and uses approved learnings', async () => {
    enableAssistant();
    const learning = {
      listRelevant: jest.fn().mockResolvedValue([{ id: 'l1', createdAt: '2026-08-20T10:00:00Z', createdBy: 'admin', caseType: 'support', principle: 'Kontrollera fraktstatus först.', appliesWhen: 'Tracking saknas.', avoid: 'Lova leveransdatum.' }]),
      save: jest.fn(),
    } as unknown as AiArmanAdminLearningStore;

    global.fetch = jest.fn(async (_url, init) => {
      const request = JSON.parse(String(init?.body || '{}'));
      expect(request.store).toBe(false);
      expect(request.input).toContain('Kontrollera fraktstatus först.');
      return new Response(JSON.stringify({
        status: 'completed',
        output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({
          caseSummary: 'Kunden saknar spårningslänk.',
          customerNeed: 'Bekräftelse på om paketet är skickat och hur det spåras.',
          recommendedActions: ['Kontrollera faktisk fraktstatus.', 'Ge tracking först om den är verifierad.'],
          reasoning: 'Frågan gäller leveransinformation och kräver verifierad fraktdata.',
          answerToAdmin: 'Kontrollera först faktisk fraktstatus. Om försändelsen är skapad kan du därefter ge verifierad tracking.',
          requiresHumanDecision: false,
          missingFacts: ['Verifierad fraktstatus'],
          learningCandidate: null,
        }) }] }],
      }), { status: 200 })) as typeof fetch;

    const service = new AiArmanAdminCaseAssistantService(new AiArmanAdminCaseAssistantConfig(), learning);
    const result = await service.assist({
      caseId: 'HQR-123',
      caseType: 'support',
      messages: [{ direction: 'inbound', sender: 'Kund', text: 'Var är min spårningslänk?' }],
    });

    expect(result).toMatchObject({
      ok: true,
      sendsCustomerMessage: false,
      executesWrites: false,
      approvedLearningsUsed: 1,
      requiresHumanDecision: false,
    });
  });

  it('requires explicit approval before saving learning', async () => {
    enableAssistant();
    process.env.AI_ARMAN_ADMIN_LEARNING_ENABLED = 'true';
    const learning = {
      listRelevant: jest.fn().mockResolvedValue([]),
      save: jest.fn(),
    } as unknown as AiArmanAdminLearningStore;
    const service = new AiArmanAdminCaseAssistantService(new AiArmanAdminCaseAssistantConfig(), learning);

    await expect(service.approveLearning({
      approved: false,
      createdBy: 'Arman',
      caseType: 'support',
      principle: 'Kontrollera fraktstatus först.',
    })).resolves.toEqual({ ok: false, code: 'admin_learning_requires_approval' });
    expect((learning.save as jest.Mock)).not.toHaveBeenCalled();
  });

  it('saves only an explicitly approved learning', async () => {
    enableAssistant();
    process.env.AI_ARMAN_ADMIN_LEARNING_ENABLED = 'true';
    const learning = {
      listRelevant: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockResolvedValue({ id: 'learn-1', createdAt: '2026-08-20T10:00:00Z' }),
    } as unknown as AiArmanAdminLearningStore;
    const service = new AiArmanAdminCaseAssistantService(new AiArmanAdminCaseAssistantConfig(), learning);

    await expect(service.approveLearning({
      approved: true,
      createdBy: 'Arman',
      caseType: 'support',
      principle: 'Kontrollera fraktstatus först.',
      appliesWhen: 'Kunden saknar tracking.',
      avoid: 'Lova något som inte är verifierat.',
    })).resolves.toEqual({ ok: true, lessonId: 'learn-1', createdAt: '2026-08-20T10:00:00Z' });
    expect((learning.save as jest.Mock)).toHaveBeenCalledTimes(1);
  });
});

function enableAssistant() {
  process.env.AI_ARMAN_ADMIN_ASSISTANT_ENABLED = 'true';
  process.env.AI_ARMAN_MODEL_INTERPRETATION_ENABLED = 'true';
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.AI_ARMAN_OPENAI_MODEL = 'gpt-test';
  process.env.AI_ARMAN_MODEL_INPUT_COST_USD_PER_MILLION_TOKENS = '1';
  process.env.AI_ARMAN_MODEL_OUTPUT_COST_USD_PER_MILLION_TOKENS = '1';
}
