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

const MAX_RESPONSE_BYTES = 256 * 1024;
const MAX_ENGINE_VERSION = 128;
const MAX_PRODUCT_ID = 128;
const MAX_DESIGNATION = 300;
const MAX_INCI = 12000;
const MAX_SHORT_TEXT = 500;
const MAX_LONG_TEXT = 2000;
const MAX_MODEL = 128;
const MAX_SOURCE_URL = 2000;
const MAX_SOURCE_TITLE = 300;
const MAX_ARRAY_ITEMS = 50;
const MAX_EVIDENCE_ITEMS = 100;
const MAX_VERIFICATION_PRODUCTS = 8;
const MAX_SOURCES = 12;
const MAX_TOKEN_COUNT = 50_000_000;
const MAX_REQUEST_LIMIT_USD = 1;
const MAX_DAILY_LIMIT_USD = 1000;
const MONEY_TOLERANCE_USD = 0.000003;
const DANGEROUS_INVISIBLE_PATTERN =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/;

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
  if (safeSerializedSize(value) > MAX_RESPONSE_BYTES) return null;
  if (value.contractVersion !== PRODUCT_INTELLIGENCE_CONTRACT_VERSION) return null;

  const engineVersion = boundedText(value.engineVersion, MAX_ENGINE_VERSION, true);
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

  const productId = boundedText(value.productId, MAX_PRODUCT_ID, true);
  const designation = isRecord(value.designation) ? value.designation : null;
  const inci = isRecord(value.inci) ? value.inci : null;
  const category = isRecord(value.category) ? value.category : null;
  const tags = isRecord(value.tags) ? value.tags : null;

  if (!productId || !designation || !inci || !category || !tags) return null;
  const normalizedDesignation = boundedText(
    designation.normalized,
    MAX_DESIGNATION,
    false,
  );
  const designationReasons = boundedStringArray(
    designation.reasons,
    MAX_ARRAY_ITEMS,
    MAX_SHORT_TEXT,
  );
  if (
    normalizedDesignation === null ||
    !isScore(designation.score) ||
    !designationReasons
  ) {
    return null;
  }

  const originalInci = boundedText(inci.original, MAX_INCI, false);
  const signals = boundedStringArray(inci.signals, MAX_ARRAY_ITEMS, MAX_SHORT_TEXT);
  const conflicts = boundedStringArray(
    inci.conflicts,
    MAX_ARRAY_ITEMS,
    MAX_LONG_TEXT,
  );
  const inciEngineVersion = boundedText(inci.engineVersion, MAX_ENGINE_VERSION, true);
  const analyzedAt = validTimestamp(inci.analyzedAt);
  if (
    originalInci === null ||
    !isScore(inci.suitabilityScore) ||
    !signals ||
    !conflicts ||
    !isConfidence(inci.confidence) ||
    !inciEngineVersion ||
    !analyzedAt
  ) {
    return null;
  }

  const categoryReasons = boundedStringArray(
    category.reasons,
    MAX_ARRAY_ITEMS,
    MAX_SHORT_TEXT,
  );
  const categoryValues = boundedStringArray(
    category.values,
    MAX_ARRAY_ITEMS,
    MAX_SHORT_TEXT,
  );
  const tagReasons = boundedStringArray(
    tags.reasons,
    MAX_ARRAY_ITEMS,
    MAX_SHORT_TEXT,
  );
  const tagValues = boundedStringArray(
    tags.values,
    MAX_ARRAY_ITEMS,
    MAX_SHORT_TEXT,
  );
  if (
    !isScore(category.score) ||
    !categoryReasons ||
    !categoryValues ||
    !isScore(tags.score) ||
    !tagReasons ||
    !tagValues
  ) {
    return null;
  }

  const hardBlockers = boundedStringArray(
    value.hardBlockers,
    MAX_ARRAY_ITEMS,
    MAX_SHORT_TEXT,
  );
  const limitations = boundedStringArray(
    value.limitations,
    MAX_ARRAY_ITEMS,
    MAX_LONG_TEXT,
  );
  const usage = boundedStringArray(value.usage, MAX_ARRAY_ITEMS, MAX_SHORT_TEXT);
  const specialFit = boundedStringArray(
    value.specialFit,
    MAX_ARRAY_ITEMS,
    MAX_SHORT_TEXT,
  );
  if (
    !hardBlockers ||
    !limitations ||
    !usage ||
    !specialFit ||
    !Array.isArray(value.evidence) ||
    value.evidence.length > MAX_EVIDENCE_ITEMS
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
      normalized: normalizedDesignation,
      score: designation.score,
      reasons: designationReasons,
    },
    inci: {
      original: originalInci,
      suitabilityScore: inci.suitabilityScore,
      signals,
      conflicts,
      confidence: inci.confidence,
      engineVersion: inciEngineVersion,
      analyzedAt,
    },
    category: {
      score: category.score,
      reasons: categoryReasons,
      values: categoryValues,
    },
    tags: {
      score: tags.score,
      reasons: tagReasons,
      values: tagValues,
    },
    hardBlockers,
    limitations,
    usage,
    specialFit,
    evidence,
  };
}

function parseEvidence(value: unknown): ProductIntelligenceEvidence | null {
  if (!isRecord(value)) return null;
  if (!isString(value.source) || !EVIDENCE_SOURCES.has(value.source)) return null;
  const key = boundedText(value.key, MAX_SHORT_TEXT, true);
  if (!key || !isConfidence(value.confidence)) return null;
  if (
    value.direction !== undefined &&
    (!isString(value.direction) || !EVIDENCE_DIRECTIONS.has(value.direction))
  ) {
    return null;
  }
  const reason =
    value.reason === undefined
      ? undefined
      : boundedText(value.reason, MAX_LONG_TEXT, false);
  if (value.reason !== undefined && reason === null) return null;

  return {
    source: value.source as ProductIntelligenceEvidence['source'],
    key,
    confidence: value.confidence,
    ...(value.direction === undefined
      ? {}
      : { direction: value.direction as ProductIntelligenceEvidence['direction'] }),
    ...(typeof reason === 'string' ? { reason } : {}),
  };
}

function parseVerification(
  value: unknown,
): ProductIntelligenceOpenAiVerification | null {
  if (!isRecord(value)) return null;
  const reason = boundedText(value.reason, MAX_SHORT_TEXT, false);
  const model = boundedText(value.model, MAX_MODEL, true);
  if (
    !isBoolean(value.enabled) ||
    !isBoolean(value.attempted) ||
    !isBoolean(value.required) ||
    reason === null ||
    !model ||
    !isBoolean(value.webSearchUsed) ||
    !isBoolean(value.cacheHit) ||
    !Array.isArray(value.products) ||
    value.products.length > MAX_VERIFICATION_PRODUCTS
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
  if (!costMatchesUsage(cost, usage)) return null;

  const error =
    value.error === undefined
      ? undefined
      : boundedText(value.error, MAX_LONG_TEXT, false);
  if (value.error !== undefined && error === null) return null;

  return {
    enabled: value.enabled,
    attempted: value.attempted,
    required: value.required,
    reason,
    model,
    webSearchUsed: value.webSearchUsed,
    cacheHit: value.cacheHit,
    products,
    ...(usage ? { usage } : {}),
    cost,
    ...(typeof error === 'string' ? { error } : {}),
  };
}

function parseResearchProduct(
  value: unknown,
): ProductIntelligenceOpenAiProductResearch | null {
  if (!isRecord(value)) return null;
  const productId = boundedText(value.productId, MAX_PRODUCT_ID, true);
  const summary = boundedText(value.summary, MAX_LONG_TEXT, false);
  const ingredientFindings = boundedStringArray(
    value.ingredientFindings,
    MAX_ARRAY_ITEMS,
    MAX_LONG_TEXT,
  );
  const problemSolving = boundedStringArray(
    value.problemSolving,
    MAX_ARRAY_ITEMS,
    MAX_LONG_TEXT,
  );
  const cautions = boundedStringArray(
    value.cautions,
    MAX_ARRAY_ITEMS,
    MAX_LONG_TEXT,
  );
  const model = boundedText(value.model, MAX_MODEL, true);
  if (
    !productId ||
    !isString(value.verdict) ||
    !RESEARCH_VERDICTS.has(value.verdict) ||
    summary === null ||
    !ingredientFindings ||
    !problemSolving ||
    !cautions ||
    !isConfidence(value.confidence) ||
    !isString(value.recommendationAction) ||
    !RECOMMENDATION_ACTIONS.has(value.recommendationAction) ||
    !Array.isArray(value.sources) ||
    value.sources.length > MAX_SOURCES ||
    !model ||
    !isBoolean(value.webSearchUsed) ||
    !isBoolean(value.cached)
  ) {
    return null;
  }

  const sources = value.sources.flatMap((source) => {
    if (!isRecord(source)) return [];
    const url = safeHttpsUrl(source.url);
    const title = boundedText(source.title, MAX_SOURCE_TITLE, false);
    return url && title !== null ? [{ url, title }] : [];
  });
  if (sources.length !== value.sources.length) return null;

  return {
    productId,
    verdict: value.verdict as ProductIntelligenceOpenAiProductResearch['verdict'],
    summary,
    ingredientFindings,
    problemSolving,
    cautions,
    confidence: value.confidence,
    recommendationAction:
      value.recommendationAction as ProductIntelligenceOpenAiProductResearch['recommendationAction'],
    sources,
    model,
    webSearchUsed: value.webSearchUsed,
    cached: value.cached,
  };
}

function parseUsage(value: unknown): ProductIntelligenceOpenAiUsage | null {
  if (!isRecord(value)) return null;
  if (
    !isTokenCount(value.inputTokens) ||
    !isTokenCount(value.cachedInputTokens) ||
    !isTokenCount(value.outputTokens) ||
    !isTokenCount(value.totalTokens)
  ) {
    return null;
  }
  if (value.cachedInputTokens > value.inputTokens) return null;
  if (value.totalTokens < value.inputTokens + value.outputTokens) return null;

  return {
    inputTokens: value.inputTokens,
    cachedInputTokens: value.cachedInputTokens,
    outputTokens: value.outputTokens,
    totalTokens: value.totalTokens,
  };
}

function parseCost(value: unknown): ProductIntelligenceOpenAiCost | null {
  if (!isRecord(value)) return null;
  const reason = boundedText(value.reason, MAX_SHORT_TEXT, false);
  if (!isBoolean(value.allowed) || reason === null) return null;

  if (
    !isNonNegativeNumber(value.estimatedMaximumUsd) ||
    !isNumberInRange(value.requestLimitUsd, 0.001, MAX_REQUEST_LIMIT_USD) ||
    !isNumberInRange(value.dailyLimitUsd, 0.01, MAX_DAILY_LIMIT_USD) ||
    !isNonNegativeNumber(value.spentTodayUsd) ||
    !isNonNegativeNumber(value.remainingTodayUsd) ||
    !isNonNegativeNumber(value.actualUsd) ||
    !isNonNegativeNumber(value.inputUsd) ||
    !isNonNegativeNumber(value.cachedInputUsd) ||
    !isNonNegativeNumber(value.outputUsd)
  ) {
    return null;
  }
  if (value.currency !== 'USD' || value.pricingVersion !== 'gpt-5.6-luna-2026-08') {
    return null;
  }

  if (
    !approximatelyEqual(
      value.actualUsd,
      value.inputUsd + value.cachedInputUsd + value.outputUsd,
    )
  ) {
    return null;
  }
  if (value.spentTodayUsd + MONEY_TOLERANCE_USD < value.actualUsd) return null;
  if (
    value.spentTodayUsd >
    value.dailyLimitUsd + value.actualUsd + MONEY_TOLERANCE_USD
  ) {
    return null;
  }
  if (
    !approximatelyEqual(
      value.remainingTodayUsd,
      Math.max(0, value.dailyLimitUsd - value.spentTodayUsd),
    )
  ) {
    return null;
  }
  if (
    value.allowed &&
    value.estimatedMaximumUsd > value.requestLimitUsd + MONEY_TOLERANCE_USD
  ) {
    return null;
  }

  return {
    allowed: value.allowed,
    reason,
    estimatedMaximumUsd: value.estimatedMaximumUsd,
    requestLimitUsd: value.requestLimitUsd,
    dailyLimitUsd: value.dailyLimitUsd,
    spentTodayUsd: value.spentTodayUsd,
    remainingTodayUsd: value.remainingTodayUsd,
    actualUsd: value.actualUsd,
    inputUsd: value.inputUsd,
    cachedInputUsd: value.cachedInputUsd,
    outputUsd: value.outputUsd,
    currency: 'USD',
    pricingVersion: 'gpt-5.6-luna-2026-08',
  };
}

function costMatchesUsage(
  cost: ProductIntelligenceOpenAiCost,
  usage: ProductIntelligenceOpenAiUsage | undefined,
): boolean {
  if (!usage) {
    return (
      approximatelyEqual(cost.actualUsd, 0) &&
      approximatelyEqual(cost.inputUsd, 0) &&
      approximatelyEqual(cost.cachedInputUsd, 0) &&
      approximatelyEqual(cost.outputUsd, 0)
    );
  }

  const uncachedInputTokens = usage.inputTokens - usage.cachedInputTokens;
  const expectedInputUsd = roundUsd(uncachedInputTokens / 1_000_000);
  const expectedCachedInputUsd = roundUsd(
    (usage.cachedInputTokens * 0.1) / 1_000_000,
  );
  const expectedOutputUsd = roundUsd((usage.outputTokens * 6) / 1_000_000);
  const expectedActualUsd = roundUsd(
    expectedInputUsd + expectedCachedInputUsd + expectedOutputUsd,
  );

  return (
    approximatelyEqual(cost.inputUsd, expectedInputUsd) &&
    approximatelyEqual(cost.cachedInputUsd, expectedCachedInputUsd) &&
    approximatelyEqual(cost.outputUsd, expectedOutputUsd) &&
    approximatelyEqual(cost.actualUsd, expectedActualUsd)
  );
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function boundedText(
  value: unknown,
  maximumLength: number,
  requireNonEmpty: boolean,
): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFC').trim();
  if (requireNonEmpty && !normalized) return null;
  if (normalized.length > maximumLength) return null;
  if (DANGEROUS_INVISIBLE_PATTERN.test(normalized)) return null;
  return normalized;
}

function boundedStringArray(
  value: unknown,
  maximumItems: number,
  maximumTextLength: number,
): string[] | null {
  if (!Array.isArray(value) || value.length > maximumItems) return null;
  const parsed: string[] = [];
  for (const item of value) {
    const text = boundedText(item, maximumTextLength, false);
    if (text === null) return null;
    parsed.push(text);
  }
  return parsed;
}

function validTimestamp(value: unknown): string | null {
  const text = boundedText(value, 64, true);
  return text && Number.isFinite(Date.parse(text)) ? text : null;
}

function safeHttpsUrl(value: unknown): string | null {
  const text = boundedText(value, MAX_SOURCE_URL, true);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function safeSerializedSize(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isScore(value: unknown): value is number {
  return isNumberInRange(value, 0, 100);
}

function isConfidence(value: unknown): value is number {
  return isNumberInRange(value, 0, 1);
}

function isTokenCount(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_TOKEN_COUNT
  );
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isNumberInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function approximatelyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= MONEY_TOLERANCE_USD;
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
