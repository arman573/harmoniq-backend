import type { AiArmanModelInterpretationCandidate } from '../chat/chat-messages.types';

export type AiArmanModelInterpretationInput = {
  text: string;
  priorMessages?: string[];
};

export type AiArmanModelInterpretationResult =
  | {
      ok: true;
      candidate: AiArmanModelInterpretationCandidate;
    }
  | {
      ok: false;
      error:
        | 'model_interpretation_disabled'
        | 'model_interpretation_unavailable'
        | 'model_interpretation_invalid';
    };
