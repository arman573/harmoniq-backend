import { readAiArmanModelInterpretationConfig } from './model-interpretation.config';
import { AiArmanModelInterpretationClient } from './model-interpretation.client';

jest.mock('./model-interpretation.config', () => ({
  readAiArmanModelInterpretationConfig: jest.fn(),
}));

const readConfig = readAiArmanModelInterpretationConfig as jest.MockedFunction<
  typeof readAiArmanModelInterpretationConfig
>;

function allowModel() {
  readConfig.mockReturnValue({
    enabled: true,
    activationAllowed: true,
    apiKey: 'configured',
    model: 'gpt-test-pinned',
    timeoutMs: 3000,
    reason: 'model_interpretation_allowed',
  });
}

function modelOutput(overrides: Record<string, unknown> = {}) {
  return {
    primaryIntent: 'tracking_status',
    secondaryIntents: [],
    confidence: 0.96,
    requestedProductTypes: [],
    needs: [],
    exclusions: [],
    orderReference: '90250',
    productReferences: [],
    recommendationDomain: null,
    ...overrides,
  };
}

function openAiResponse(output: unknown, status = 200): Response {
  return new Response(
    JSON.stringify({
      status: status === 200 ? 'completed' : 'failed',
      output: [
        {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'output_text',
              text: JSON.stringify(output),
              annotations: [],
            },
          ],
        },
      ],
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

describe('AiArmanModelInterpretationClient', () => {
  afterEach(() => jest.restoreAllMocks());

  it('fails closed before fetch when model interpretation is disabled', async () => {
    readConfig.mockReturnValue({
      enabled: false,
      activationAllowed: false,
      apiKey: '',
      model: '',
      timeoutMs: 3000,
      reason: 'default_disabled',
    });
    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(
      new AiArmanModelInterpretationClient().interpret({ text: 'Var är paketet?' }),
    ).resolves.toEqual({
      ok: false,
      error: 'model_interpretation_disabled',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('uses Responses API structured output without response storage and returns only a candidate', async () => {
    allowModel();
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(openAiResponse(modelOutput()));

    const result = await new AiArmanModelInterpretationClient().interpret({
      text: 'Var är mitt paket för order 90250?',
      priorMessages: ['Hej'],
    });

    expect(result).toEqual({
      ok: true,
      candidate: {
        schemaVersion: 'ai-arman-interpretation-v1',
        source: 'model_candidate',
        locale: 'sv-SE',
        primaryIntent: 'tracking_status',
        secondaryIntents: [],
        confidence: 0.96,
        entities: {
          requestedProductTypes: [],
          needs: [],
          exclusions: [],
          orderReference: '90250',
          productReferences: [],
          recommendationDomain: null,
        },
        missingFields: [],
        requiresIdentity: true,
        requiresHumanReview: false,
      },
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe('https://api.openai.com/v1/responses');
    expect(options).toMatchObject({
      method: 'POST',
      redirect: 'error',
    });
    const requestBody = JSON.parse(String(options?.body));
    expect(requestBody.model).toBe('gpt-test-pinned');
    expect(requestBody.store).toBe(false);
    expect(requestBody.text?.format).toMatchObject({
      type: 'json_schema',
      name: 'ai_arman_interpretation',
      strict: true,
    });
    expect(requestBody.tools).toBeUndefined();
  });

  it('redacts email addresses before sending interpretation input', async () => {
    allowModel();
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(openAiResponse(modelOutput()));

    await new AiArmanModelInterpretationClient().interpret({
      text: 'Min mejl är customer@example.com och order 90250 saknas',
    });

    const requestBody = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(requestBody.input).not.toContain('customer@example.com');
    expect(requestBody.input).toContain('[email_redacted]');
    expect(requestBody.input).toContain('90250');
  });

  it('derives identity requirements in backend instead of trusting model policy', async () => {
    allowModel();
    jest.spyOn(global, 'fetch').mockResolvedValue(
      openAiResponse(
        modelOutput({
          primaryIntent: 'purchased_product_usage',
          orderReference: null,
          productReferences: ['Olaplex No.4'],
        }),
      ),
    );

    await expect(
      new AiArmanModelInterpretationClient().interpret({
        text: 'Hur ofta kan jag använda Olaplex No.4 som jag köpt?',
      }),
    ).resolves.toMatchObject({
      ok: true,
      candidate: {
        primaryIntent: 'purchased_product_usage',
        missingFields: ['verifiedOrderIdentity'],
        requiresIdentity: true,
      },
    });
  });

  it('fails closed on malformed or unknown model output', async () => {
    allowModel();
    jest.spyOn(global, 'fetch').mockResolvedValue(
      openAiResponse(modelOutput({ primaryIntent: 'delete_order' })),
    );

    await expect(
      new AiArmanModelInterpretationClient().interpret({ text: 'Ta bort min order' }),
    ).resolves.toEqual({
      ok: false,
      error: 'model_interpretation_invalid',
    });
  });

  it('fails closed on upstream errors without exposing upstream details', async () => {
    allowModel();
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('secret upstream details', { status: 500 }));

    await expect(
      new AiArmanModelInterpretationClient().interpret({ text: 'Hej' }),
    ).resolves.toEqual({
      ok: false,
      error: 'model_interpretation_unavailable',
    });
  });
});
