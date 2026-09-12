import { AiArmanCustomerResponseConfig } from './ai-arman-customer-response.config';
import { AiArmanCustomerResponseService } from './ai-arman-customer-response.service';

const request = {
  contractVersion: 'ai-arman-chat-v1',
  clientMessageId: 'm1',
  message: { text: 'Var är mitt paket?' },
  context: { locale: 'sv-SE', channel: 'web_widget' },
} as any;

function backendResponse() {
  return {
    contractVersion: 'ai-arman-chat-v1',
    conversationId: 'c1',
    serverMessageId: 's1',
    interpretation: {
      schemaVersion: 'ai-arman-interpretation-v1',
      source: 'deterministic_fallback',
      locale: 'sv-SE',
      primaryIntent: 'tracking_status',
      secondaryIntents: [],
      confidence: 0.9,
      entities: {
        requestedProductTypes: [], needs: [], exclusions: [], orderReference: null, productReferences: [],
      },
      missingFields: [], requiresIdentity: true, requiresHumanReview: false,
    },
    state: {
      stateVersion: 'ai-arman-conversation-state-v1', conversationId: 'c1', status: 'ready_for_tools',
      activeJourney: 'after_purchase', locale: 'sv-SE', identityLevel: 'anonymous',
      remembered: { requestedProductTypes: [], needs: [], exclusions: [], orderReference: null, productReferences: [] },
      pendingQuestion: null,
    },
    decision: {
      owner: 'backend_policy', route: 'order_support', plannedTools: ['get_tracking_status'],
      executionStatus: 'executed_read_only', requiresIdentity: true, requiresConfirmation: false, reasons: ['Verifierad tracking läst'],
    },
    blocks: [
      { type: 'message', text: 'Ditt paket är på väg.' },
      { type: 'tracking_card', orderNumber: '90250', carrier: 'DHL', trackingStatus: 'in_transit', trackingLabel: 'På väg', trackingUrl: null, readAt: '2026-08-19T12:00:00Z' },
    ],
    safety: { aiModelUsed: false, liveFactsUsed: true, writesExecuted: false, productionActionsEnabled: false, htmlAcceptedFromModel: false },
  } as any;
}

describe('AiArmanCustomerResponseService', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('returns backend response unchanged when generation is disabled', async () => {
    process.env.AI_ARMAN_CUSTOMER_RESPONSE_ENABLED = 'false';
    const service = new AiArmanCustomerResponseService(new AiArmanCustomerResponseConfig());
    const response = backendResponse();
    const fetchSpy = jest.spyOn(global, 'fetch');
    await expect(service.formulate(request, response)).resolves.toBe(response);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('replaces only message blocks and preserves backend-owned structured facts', async () => {
    enableModel();
    global.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body || '{}'));
      const serializedInput = String(payload.input || '');
      expect(serializedInput).not.toContain('90250');
      expect(serializedInput).toContain('DHL');
      return new Response(JSON.stringify({
        status: 'completed',
        output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ replyText: 'Ditt paket är på väg med DHL.' }) }] }],
      }), { status: 200 });
    }) as typeof fetch;

    const service = new AiArmanCustomerResponseService(new AiArmanCustomerResponseConfig());
    const result = await service.formulate(request, backendResponse());
    expect(result.blocks[0]).toEqual({ type: 'message', text: 'Ditt paket är på väg med DHL.' });
    expect(result.blocks[1]).toMatchObject({ type: 'tracking_card', orderNumber: '90250', trackingLabel: 'På väg' });
    expect(result.safety).toMatchObject({ aiModelUsed: true, writesExecuted: false, productionActionsEnabled: false, htmlAcceptedFromModel: false });
  });

  it('fails back to backend response when model invents a numeric fact', async () => {
    enableModel();
    global.fetch = jest.fn(async () => new Response(JSON.stringify({
      status: 'completed',
      output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ replyText: 'Paketet kommer om 3 dagar.' }) }] }],
    }), { status: 200 })) as typeof fetch;

    const service = new AiArmanCustomerResponseService(new AiArmanCustomerResponseConfig());
    const response = backendResponse();
    await expect(service.formulate(request, response)).resolves.toBe(response);
  });
});

function enableModel() {
  process.env.AI_ARMAN_CUSTOMER_RESPONSE_ENABLED = 'true';
  process.env.AI_ARMAN_MODEL_INTERPRETATION_ENABLED = 'true';
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.AI_ARMAN_OPENAI_MODEL = 'gpt-test';
  process.env.AI_ARMAN_MODEL_INPUT_COST_USD_PER_MILLION_TOKENS = '1';
  process.env.AI_ARMAN_MODEL_OUTPUT_COST_USD_PER_MILLION_TOKENS = '1';
  process.env.AI_ARMAN_MODEL_INTERPRETATION_TIMEOUT_MS = '3000';
}
