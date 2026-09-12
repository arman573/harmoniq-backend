export type ChatInterpretationPromotionConfig = {
  enabled: boolean;
  minConfidence: number;
};

const DEFAULT_MIN_CONFIDENCE = 0.88;

export function readChatInterpretationPromotionConfig(): ChatInterpretationPromotionConfig {
  return {
    enabled:
      String(process.env.AI_ARMAN_MODEL_PROMOTION_ENABLED || '') === 'true',
    minConfidence: readMinConfidence(),
  };
}

function readMinConfidence(): number {
  const configured = Number(process.env.AI_ARMAN_MODEL_PROMOTION_MIN_CONFIDENCE);
  if (!Number.isFinite(configured)) return DEFAULT_MIN_CONFIDENCE;
  return Math.min(0.99, Math.max(0.5, configured));
}
