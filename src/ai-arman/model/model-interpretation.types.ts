import type { AiArmanModelInterpretationCandidate } from '../chat/chat-messages.types';

export type AiArmanModelInterpretationInput = {
  text: string;
  priorMessages?: string[];
};

export type AiArmanModelInterpretationUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type AiArmanModelInterpretationResult =
  | {
      ok: true;
      candidate: AiArmanModelInterpretationCandidate;
      usage: AiArmanModelInterpretationUsage;
    }
  | {
      ok: false;
      error:
        | 'model_interpretation_disabled'
        | 'model_interpretation_authentication'
        | 'model_interpretation_quota'
        | 'model_interpretation_unavailable'
        | 'model_interpretation_invalid';
    };
