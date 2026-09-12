import { AiArmanModelInterpretationClient } from './model-interpretation.client';

const FAILURE_EXIT_CODES: Record<string, number> = {
  model_interpretation_authentication: 41,
  model_interpretation_quota: 42,
  model_interpretation_unavailable: 43,
  model_interpretation_invalid: 44,
  model_interpretation_disabled: 45,
};

async function main() {
  const client = new AiArmanModelInterpretationClient();
  const result = await client.interpret({
    text: 'Jag behöver hjälp att välja ett schampo för torrt hår.',
  });

  if (!result.ok) {
    console.error(`MODEL_PROVIDER_SMOKE=FAIL code=${result.error}`);
    process.exit(FAILURE_EXIT_CODES[result.error] ?? 49);
  }

  if (result.candidate.source !== 'model_candidate') {
    console.error('MODEL_PROVIDER_SMOKE=FAIL code=unexpected_source');
    process.exit(46);
  }

  const inputPrice = Number(
    process.env.AI_ARMAN_MODEL_INPUT_COST_USD_PER_MILLION_TOKENS,
  );
  const outputPrice = Number(
    process.env.AI_ARMAN_MODEL_OUTPUT_COST_USD_PER_MILLION_TOKENS,
  );
  const estimatedCostUsd =
    (result.usage.inputTokens * inputPrice) / 1_000_000 +
    (result.usage.outputTokens * outputPrice) / 1_000_000;

  console.log('MODEL_PROVIDER_SMOKE=PASS');
  console.log(`MODEL_PROVIDER_INTENT=${result.candidate.primaryIntent}`);
  console.log(`MODEL_PROVIDER_INPUT_TOKENS=${result.usage.inputTokens}`);
  console.log(`MODEL_PROVIDER_OUTPUT_TOKENS=${result.usage.outputTokens}`);
  console.log(`MODEL_PROVIDER_ESTIMATED_COST_USD=${estimatedCostUsd.toFixed(6)}`);
  console.log(`MODEL_PROVIDER_REQUIRES_IDENTITY=${result.candidate.requiresIdentity}`);
}

main().catch(() => {
  console.error('MODEL_PROVIDER_SMOKE=FAIL code=unexpected_error');
  process.exit(49);
});
