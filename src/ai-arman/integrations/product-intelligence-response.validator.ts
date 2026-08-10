import {
  PRODUCT_INTELLIGENCE_CONTRACT_VERSION,
  ProductIntelligenceAnalysis,
  ProductIntelligenceBatchResponse,
  ProductIntelligenceEvidence,
  ProductIntelligenceOpenAiCost,
  ProductIntelligenceOpenAiProductResearch,
  ProductIntelligenceOpenAiUsage,
  ProductIntelligenceOpenAiVerification,
} from './product-intelligence.types';

type UnknownRecord = Record<string, unknown>;

const EVIDENCE_SOURCES = new Set([
  'product_data',
  'product_tag',
  'product_category',
  'ingredient_intelligence',
  'rule',
  'manual',
]);
const EVIDENCE_DIRECTIONS = new Set(['positive', 'negative', 'neutral']);
const RESEARCH_VERDICTS = new Set([
  'supported',
  'mixed',
  'unsupported',
  'uncertain',
]);
const RECOMMENDATION_ACTIONS = new Set([
  'retain',
  'caution',
  'block',
  'insufficient',
]);

export function parseProductIntelligenceBatchResponse(
  value: unknown,
): ProductIntelligenceBatchResponse | null {
  if (!isRecord(value) || value.ok !== true) return null;
  if (value.contractVersion !== PRODUCT_INTELLIGENCE_CONTRACT_VERSION) return null;

  const engineVersion = nonEmptyText(value.engineVersion);
  const generatedAt = validTimestamp(value.generatedAt);
  if (!engineVersion || !generatedAt || !Array.isArray(value.analyses)) return null;
  if (value.analyses.length > 25) return null;

  const analyses: ProductIntelligenceAnalysis[] = [];
  const productIds = new Set<string>();
  for (const item of value.analyses) {
    const analysis = parseAnalysis(item);
    if (!analysis || productIds.has(analysis.productId)) return null;
    productIds.add(analysis.productId);
    analyses.push(analysis);
  }

  const verification = parseVerification(value.verification);
  if (!verification) return null;

  return {
    ok: true,
    contractVersion: PRODUCT_INTELLIGENCE_CONTRACT_VERSION,
    engineVersion,
    generatedAt,
    analyses,
    verification,
  };
}

function parseAnalysis(value: unknown): ProductIntelligenceAnalysis | null {
  if (!isRecord(value)) return null;

  const productId = nonEmptyText(value.productId);
  const designation = isRecord(value.designation) ? value.designation : null;
  const inci = isRecord(value.inci) ? value.inci : null;
  const category = isRecord(value.category) ? value.category : null;
  const tags = isRecord(value.tags) ? value.tags : null;

  if (!productId || !designation || !inci || !category || !tags) return null;
  if (!isString(value.designation?.normalized) || !isFiniteNumber(designation.score)) {
    return null;
  }
  if (!isStringArray(designation.reasons)) return null;

  if (
    !isString(inci.original) ||
    !isFiniteNumber(inci.suitabilityScore) ||
    !isStringArray(inci.signals) ||
    !isStringArray(inci.conflicts) ||
    !isFiniteNumber(inci.confidence) ||
    !isString(inci.engineVersion) ||
    !isString(inci.analyzedAt)
  ) {
    return null;
  }

  if (
    !isFiniteNumber(category.score) ||
    !isStringArray(category.reasons) ||
    !isStringArray(category.values) ||
    !isFiniteNumber(tags.score) ||
    !isStringArray(tags.reasons) ||
    !isStringArray(tags.values)
  ) {
    return null;
  }

  if (
    !isStringArray(value.hardBlockers) ||
    !isStringArray(value.limitations) ||
    !isStringArray(value.usage) ||
    !isStringArray(value.specialFit) ||
    !Array.isArray(value.evidence)
  ) {
    return null;
  }

  const evidence: ProductIntelligenceEvidence[] = [];
  for (const item of value.evidence) {
    const parsed = parseEvidence(item);
    if (!parsed) return null;
    evidence.push(parsed);
  }

  return {
    productId,
    designation: {
      normalized: designation.normalized as string,
      score: designation.score as number,
      reasons: designation.reasons as string[],
    },
    inci: {
      original: inci.original as string,
      suitabilityScore: inci.suitabilityScore as number,
      signals: inci.signals as string[],
      conflicts: inci.conflicts as string[],
      confidence: inci.confidence as number,
      engineVersion: inci.engineVersion as string,
      analyzedAt: inci.analyzedAt as string,
    },
    category: {
      score: category.score as number,
      reasons: category.reasons as string[],
      values: category.values as string[],
    },
    tags: {
      score: tags.score as number,
      reasons: tags.reasons as string[],
      values: tags.values as string[],
    },
    hardBlockers: value.hardBlockers as string[],
    limitations: value.limitations as string[],
    usage: value.usage as string[],
    specialFit: value.specialFit as string[],
    evidence,
  };
}

function parseEvidence(value: unknown): ProductIntelligenceEvidence | null {
  if (!isRecord(value)) return null;
  if (!isString(value.source) || !EVIDENCE_SOURCES.has(value.source)) return null;
  if (!nonEmptyText(value.key) || !isFiniteNumber(value.confidence)) return null;
  if (
    value.direction !== undefined &&
    (!isString(value.direction) || !EVIDENCE_DIRECTIONS.has(value.direction))
  ) {
    return null;
  }
  if (value.reason !== undefined && !isString(value.reason)) return null;

  return {
    source: value.source as ProductIntelligenceEvidence['source'],
    key: value.key as string,
    confidence: value.confidence as number,
    ...(value.direction === undefined
      ? {}
      : { direction: value.direction as ProductIntelligenceEvidence['direction'] }),
    ...(value.reason === undefined ? {} : { reason: value.reason as string }),
  };
}

function parseVerification(
  value: unknown,
): ProductIntelligenceOpenAiVerification | null {
  if (!isRecord(value)) return null;
  if (
    !isBoolean(value.enabled) ||
    !isBoolean(value.attempted) ||
    !isBoolean(value.required) ||
    !isString(value.reason) ||
    !isString(value.model) ||
    !isBoolean(value.webSearchUsed) ||
    !isBoolean(value.cacheHit) ||
    !Array.isArray(value.products)
  ) {
    return null;
  }

  const products: ProductIntelligenceOpenAiProductResearch[] = [];
  for (const item of value.products) {
    const parsed = parseResearchProduct(item);
    if (!parsed) return null;
    products.push(parsed);
  }

  const cost = parseCost(value.cost);
  if (!cost) return null;

  const usage = value.usage === undefined ? undefined : parseUsage(value.usage);
  if (value.usage !== undefined && !usage) return null;
  if (value.error !== undefined && !isString(value.error)) return null;

  return {
    enabled: value.enabled,
    attempted: value.attempted,
    required: value.required,
    reason: value.reason,
    model: value.model,
    webSearchUsed: value.webSearchUsed,
    cacheHit: value.cacheHit,
    products,
    ...(usage ? { usage } : {}),
    cost,
    ...(value.error === undefined ? {} : { error: value.error }),
  };
}

function parseResearchProduct(
  value: unknown,
): ProductIntelligenceOpenAiProductResearch | null {
  if (!isRecord(value)) return null;
  if (
    !nonEmptyText(value.productId) ||
    !isString(value.verdict) ||
    !RESEARCH_VERDICTS.has(value.verdict) ||
    !isString(value.summary) ||
    !isStringArray(value.ingredientFindings) ||
    !isStringArray(value.problemSolving) ||
    !isStringArray(value.cautions) ||
    !isFiniteNumber(value.confidence) ||
    !isString(value.recommendationAction) ||
    !RECOMMENDATION_ACTIONS.has(value.recommendationAction) ||
    !Array.isArray(value.sources) ||
    !isString(value.model) ||
    !isBoolean(value.webSearchUsed) ||
    !isBoolean(value.cached)
  ) {
    return null;
  }

  const sources = value.sources.flatMap((source) => {
    if (!isRecord(source) || !isString(source.url) || !isString(source.title)) return [];
    return [{ url: source.url, title: source.title }];
  });
  if (sources.length !== value.sources.length) return null;

  return {
    productId: value.productId as string,
    verdict: value.verdict as ProductIntelligenceOpenAiProductResearch['verdict'],
    summary: value.summary,
    ingredientFindings: value.ingredientFindings,
    problemSolving: value.problemSolving,
    cautions: value.cautions,
    confidence: value.confidence,
    recommendationAction:
      value.recommendationAction as ProductIntelligenceOpenAiProductResearch['recommendationAction'],
    sources,
    model: value.model,
    webSearchUsed: value.webSearchUsed,
    cached: value.cached,
  };
}

function parseUsage(value: unknown): ProductIntelligenceOpenAiUsage | null {
  if (!isRecord(value)) return null;
  if (
    !isFiniteNumber(value.inputTokens) ||
    !isFiniteNumber(value.cachedInputTokens) ||
    !isFiniteNumber(value.outputTokens) ||
    !isFiniteNumber(value.totalTokens)
  ) {
    return null;
  }
  return {
    inputTokens: value.inputTokens,
    cachedInputTokens: value.cachedInputTokens,
    outputTokens: value.outputTokens,
    totalTokens: value.totalTokens,
  };
}

function parseCost(value: unknown): ProductIntelligenceOpenAiCost | null {
  if (!isRecord(value)) return null;
  const numberKeys = [
    'estimatedMaximumUsd',
    'requestLimitUsd',
    'dailyLimitUsd',
    'spentTodayUsd',
    'remainingTodayUsd',
    'actualUsd',
    'inputUsd',
    'cachedInputUsd',
    'outputUsd',
  ] as const;

  if (!isBoolean(value.allowed) || !isString(value.reason)) return null;
  if (numberKeys.some((key) => !isFiniteNumber(value[key]))) return null;
  if (value.currency !== 'USD' || value.pricingVersion !== 'gpt-5.6-luna-2026-08') {
    return null;
  }

  return {
    allowed: value.allowed,
    reason: value.reason,
    estimatedMaximumUsd: value.estimatedMaximumUsd as number,
    requestLimitUsd: value.requestLimitUsd as number,
    dailyLimitUsd: value.dailyLimitUsd as number,
    spentTodayUsd: value.spentTodayUsd as number,
    remainingTodayUsd: value.remainingTodayUsd as number,
    actualUsd: value.actualUsd as number,
    inputUsd: value.inputUsd as number,
    cachedInputUsd: value.cachedInputUsd as number,
    outputUsd: value.outputUsd as number,
    currency: 'USD',
    pricingVersion: 'gpt-5.6-luna-2026-08',
  };
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function nonEmptyText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function validTimestamp(value: unknown): string | null {
  const text = nonEmptyText(value);
  return text && Number.isFinite(Date.parse(text)) ? text : null;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}
