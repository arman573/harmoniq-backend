import { ChatInterpretationProviderError } from '../chat/chat-interpretation.provider';
import { readAiArmanModelInterpretationConfig } from './model-interpretation.config';
import { AiArmanModelInterpretationClient } from './model-interpretation.client';
import { OpenAiChatInterpretationProvider } from './openai-chat-interpretation.provider';

jest.mock('./model-interpretation.config', () => ({
  readAiArmanModelInterpretationConfig: jest.fn(),
}));

const readConfig = readAiArmanModelInterpretationConfig as jest.MockedFunction<
  typeof readAiArmanModelInterpretationConfig
>;

describe('OpenAiChatInterpretationProvider', () => {
  const client = {
    interpret: jest.fn(),
  } as unknown as AiArmanModelInterpretationClient;

  beforeEach(() => {
    jest.clearAllMocks();
    readConfig.mockReturnValue({
      enabled: true,
      activationAllowed: true,
      apiKey: 'configured',
      model: 'gpt-5-mini',
      timeoutMs: 3000,
      inputCostUsdPerMillionTokens: 0.25,
      outputCostUsdPerMillionTokens: 2,
      reason: 'model_interpretation_allowed',
    });
  });

  it('adds an estimated USD cost from explicit configured rates', async () => {
    (client.interpret as jest.Mock).mockResolvedValue({
      ok: true,
      candidate: { primaryIntent: 'greeting' },
      usage: { inputTokens: 1000, outputTokens: 500 },
    });

    const result = await new OpenAiChatInterpretationProvider(client).interpret({
      text: 'Hej',
      locale: 'sv-SE',
      previousState: null,
    });

    expect(result.usage).toEqual({
      inputTokens: 1000,
      outputTokens: 500,
      estimatedCostUsd: 0.00125,
    });
  });

  it('fails before provider use when activation is not fully configured', async () => {
    readConfig.mockReturnValue({
      enabled: true,
      activationAllowed: false,
      apiKey: 'configured',
      model: 'gpt-5-mini',
      timeoutMs: 3000,
      inputCostUsdPerMillionTokens: 0,
      outputCostUsdPerMillionTokens: 0,
      reason: 'pricing_missing_or_invalid',
    });

    await expect(
      new OpenAiChatInterpretationProvider(client).interpret({
        text: 'Hej',
        locale: 'sv-SE',
        previousState: null,
      }),
    ).rejects.toEqual(expect.objectContaining<Partial<ChatInterpretationProviderError>>({
      code: 'unavailable',
    }));

    expect(client.interpret).not.toHaveBeenCalled();
  });
});
