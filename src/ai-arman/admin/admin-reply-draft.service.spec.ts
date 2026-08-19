import { AiArmanAdminReplyDraftConfig } from './admin-reply-draft.config';
import { AiArmanAdminReplyDraftService } from './admin-reply-draft.service';

describe('AiArmanAdminReplyDraftService', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('fails closed when admin reply drafting is disabled', async () => {
    process.env.AI_ARMAN_ADMIN_REPLY_DRAFT_ENABLED = 'false';
    const service = new AiArmanAdminReplyDraftService(new AiArmanAdminReplyDraftConfig());
    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(service.createDraft({ caseId: 'HQR-123' })).rejects.toMatchObject({ status: 404 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('redacts email and returns an allowlisted draft without writes', async () => {
    enableModel();
    const fetchMock = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body || '{}'));
      expect(request.store).toBe(false);
      expect(request.input).not.toContain('kund@example.se');
      expect(request.input).toContain('[email_redacted]');
      return new Response(JSON.stringify({
        status: 'completed',
        output: [{
          type: 'message',
          content: [{
            type: 'output_text',
            text: JSON.stringify({
              draftText: 'Hej! Tack för ditt meddelande. Vi tittar på detta och återkommer.',
              requiresHumanDecision: false,
              decisionReasons: [],
              confidence: 0.91,
            }),
          }],
        }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    global.fetch = fetchMock as typeof fetch;

    const service = new AiArmanAdminReplyDraftService(new AiArmanAdminReplyDraftConfig());
    await expect(service.createDraft({
      caseId: 'HQR-123',
      messages: [{ direction: 'inbound', text: 'Maila mig på kund@example.se tack.' }],
    })).resolves.toEqual({
      ok: true,
      draftText: 'Hej! Tack för ditt meddelande. Vi tittar på detta och återkommer.',
      requiresHumanDecision: false,
      decisionReasons: [],
      confidence: 0.91,
      sendsCustomerMessage: false,
      executesWrites: false,
    });
  });

  it('preserves the human-decision safety marker', async () => {
    enableModel();
    global.fetch = jest.fn(async () => new Response(JSON.stringify({
      status: 'completed',
      output: [{
        type: 'message',
        content: [{
          type: 'output_text',
          text: JSON.stringify({
            draftText: 'Hej! Vi behöver först granska ärendet innan vi kan ge besked om återbetalning.',
            requiresHumanDecision: true,
            decisionReasons: ['Återbetalning kräver mänskligt beslut'],
            confidence: 0.88,
          }),
        }],
      }],
    }), { status: 200 })) as typeof fetch;

    const service = new AiArmanAdminReplyDraftService(new AiArmanAdminReplyDraftConfig());
    const result = await service.createDraft({ caseId: 'HQR-456', caseType: 'claim' });
    expect(result).toMatchObject({
      ok: true,
      requiresHumanDecision: true,
      sendsCustomerMessage: false,
      executesWrites: false,
    });
  });
});

function enableModel() {
  process.env.AI_ARMAN_ADMIN_REPLY_DRAFT_ENABLED = 'true';
  process.env.AI_ARMAN_MODEL_INTERPRETATION_ENABLED = 'true';
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.AI_ARMAN_OPENAI_MODEL = 'gpt-test';
  process.env.AI_ARMAN_MODEL_INPUT_COST_USD_PER_MILLION_TOKENS = '1';
  process.env.AI_ARMAN_MODEL_OUTPUT_COST_USD_PER_MILLION_TOKENS = '1';
  process.env.AI_ARMAN_MODEL_INTERPRETATION_TIMEOUT_MS = '3000';
}
