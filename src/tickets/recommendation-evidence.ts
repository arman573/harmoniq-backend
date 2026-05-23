import {
  BeautyDomain,
  getDomainForKey,
  normalizeDomainKey,
} from '../beauty-domain';
import { IngredientIntelligenceResult } from '../ingredients/ingredients.service';
import { ProductAnalysis } from '../products/product-analysis.entity';
import { ProductTag } from '../products/product-tag.entity';
import { CustomerFact } from './customer-fact.entity';
import {
  getFactDomain,
  getProductTagDomain,
  RecommendationScoreBreakdown,
  RecommendationScoreSource,
} from './recommendation-scoring';

export type EvidenceSource =
  | 'customer_fact'
  | 'customer_profile'
  | 'product_tag'
  | 'product_analysis'
  | 'ingredient_intelligence'
  | 'fragrance_profile'
  | 'rule'
  | 'manual';

export type EvidencePolarity = 'positive' | 'negative' | 'neutral';

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export type EvidenceItem = {
  code: string;
  label: string;
  detail: string;
  source: EvidenceSource;
  domain: BeautyDomain;
  confidence: number;
  impact?: number;
  polarity: EvidencePolarity;
};

export type EvidenceConflict = {
  code: string;
  label: string;
  detail: string;
  domain: BeautyDomain;
  severity: 'low' | 'medium' | 'high';
};

export type EvidenceSummary = {
  confidence: number;
  level: ConfidenceLevel;
  positiveEvidence: EvidenceItem[];
  negativeEvidence: EvidenceItem[];
  neutralEvidence: EvidenceItem[];
  missingEvidence: string[];
  conflicts: EvidenceConflict[];
};

type RecommendationEvidenceInput = {
  customerFacts?: CustomerFact[];
  productTags?: ProductTag[];
  productAnalysis?: ProductAnalysis;
  ingredientIntelligence?: IngredientIntelligenceResult;
  scoreBreakdown: RecommendationScoreBreakdown;
};

const SOURCE_CONFIDENCE_WEIGHTS: Record<EvidenceSource, number> = {
  customer_fact: 0.75,
  customer_profile: 0.8,
  product_tag: 0.7,
  product_analysis: 0.65,
  ingredient_intelligence: 0.85,
  fragrance_profile: 0.75,
  rule: 0.9,
  manual: 0.8,
};

const MISSING_EVIDENCE_PENALTIES: Record<string, number> = {
  missing_product_analysis: 0.15,
  missing_ingredient_intelligence: 0.08,
  low_analysis_confidence: 0.12,
  no_customer_facts: 0.15,
  no_product_tags: 0.07,
};

export function buildRecommendationEvidence(
  input: RecommendationEvidenceInput,
): EvidenceSummary {
  const positiveEvidence: EvidenceItem[] = [];
  const negativeEvidence: EvidenceItem[] = [];
  const neutralEvidence: EvidenceItem[] = [];
  const facts = getFactValueMap(input.customerFacts);
  const productTags = getProductTagConcepts(input.productTags);
  const analysisConcepts = getAnalysisConcepts(input.productAnalysis);
  const ingredientIntelligence =
    input.ingredientIntelligence ??
    getIngredientIntelligence(input.productAnalysis);
  const ingredientBenefits = new Set(ingredientIntelligence?.benefits || []);
  const ingredientRisks = new Set(ingredientIntelligence?.risks || []);
  const ingredientWarnings = new Set(ingredientIntelligence?.warnings || []);
  const fragranceProfile = getFragranceProfileConcepts(input.productAnalysis);
  const warnings = getWarningConcepts(
    input.productAnalysis,
    ingredientIntelligence,
  );
  const productConcepts = new Set([
    ...productTags.keys(),
    ...analysisConcepts,
    ...warnings,
    ...ingredientBenefits,
    ...ingredientRisks,
    ...ingredientWarnings,
    ...fragranceProfile.families,
    ...fragranceProfile.performance,
    ...fragranceProfile.context,
    ...fragranceProfile.risks,
  ]);

  for (const item of input.scoreBreakdown.positives) {
    addEvidence(positiveEvidence, {
      code: item.code,
      label: item.label,
      detail: `${item.label} increased the recommendation score.`,
      source: toEvidenceSource(item.source),
      domain: item.domain,
      confidence: getEvidenceConfidence(
        toEvidenceSource(item.source),
        item.confidence ??
          getSourceConfidence(item.source, input.productAnalysis),
      ),
      impact: item.impact,
      polarity: 'positive',
    });
  }

  for (const item of input.scoreBreakdown.negatives) {
    addEvidence(negativeEvidence, {
      code: item.code,
      label: item.label,
      detail: `${item.label} reduced the recommendation score.`,
      source: toEvidenceSource(item.source),
      domain: item.domain,
      confidence: getEvidenceConfidence(
        toEvidenceSource(item.source),
        item.confidence ??
          getSourceConfidence(item.source, input.productAnalysis),
      ),
      impact: item.impact,
      polarity: 'negative',
    });
  }

  for (const blocker of input.scoreBreakdown.blockers) {
    addEvidence(negativeEvidence, {
      code: blocker.code,
      label: blocker.label,
      detail: blocker.detail,
      source: 'rule',
      domain: blocker.domain,
      confidence: getEvidenceConfidence('rule'),
      impact: blocker.impact,
      polarity: 'negative',
    });
  }

  for (const [value, fact] of facts) {
    if (!productConcepts.has(value)) continue;

    addEvidence(positiveEvidence, {
      code: `customer_fact_${value}`,
      label: `Customer fact: ${formatLabel(value)}`,
      detail: `Customer has a recorded ${formatLabel(value)} signal.`,
      source: 'customer_fact',
      domain: getFactDomain(fact),
      confidence: getEvidenceConfidence(
        'customer_fact',
        getOwnConfidence(fact),
      ),
      polarity: 'positive',
    });
  }

  for (const [value, tag] of productTags) {
    if (!facts.has(value)) continue;

    addEvidence(positiveEvidence, {
      code: `product_tag_${value}`,
      label: `Product tag: ${formatLabel(value)}`,
      detail: `Product tag matches the customer's ${formatLabel(value)} signal.`,
      source: 'product_tag',
      domain: getProductTagDomain(tag),
      confidence: getEvidenceConfidence('product_tag'),
      polarity: 'positive',
    });
  }

  for (const concept of analysisConcepts) {
    addEvidence(neutralEvidence, {
      code: `analysis_${concept}`,
      label: `Analysis signal: ${formatLabel(concept)}`,
      detail: `ProductAnalysis includes the ${formatLabel(concept)} signal.`,
      source: 'product_analysis',
      domain: getDomainForKey(concept),
      confidence: getEvidenceConfidence(
        'product_analysis',
        input.productAnalysis?.confidence,
      ),
      polarity: 'neutral',
    });
  }

  for (const warning of warnings) {
    addEvidence(negativeEvidence, {
      code: warning,
      label: formatLabel(warning),
      detail: `Structured analysis includes the ${formatLabel(warning)} warning.`,
      source: getWarningSource(
        warning,
        input.productAnalysis,
        ingredientIntelligence,
      ),
      domain: getDomainForKey(warning),
      confidence: getEvidenceConfidence(
        getWarningSource(
          warning,
          input.productAnalysis,
          ingredientIntelligence,
        ),
        input.productAnalysis?.confidence,
      ),
      polarity: 'negative',
    });
  }

  for (const benefit of ingredientBenefits) {
    addEvidence(positiveEvidence, {
      code: `ingredient_benefit_${benefit}`,
      label: `Ingredient benefit: ${formatLabel(benefit)}`,
      detail: `Ingredient Intelligence detected ${formatLabel(benefit)} support.`,
      source: 'ingredient_intelligence',
      domain: getDomainForKey(benefit),
      confidence: getEvidenceConfidence('ingredient_intelligence'),
      polarity: 'positive',
    });
  }

  for (const risk of new Set([...ingredientRisks, ...ingredientWarnings])) {
    addEvidence(negativeEvidence, {
      code: `ingredient_risk_${risk}`,
      label: `Ingredient risk: ${formatLabel(risk)}`,
      detail: `Ingredient Intelligence detected ${formatLabel(risk)} risk.`,
      source: 'ingredient_intelligence',
      domain: getDomainForKey(risk),
      confidence: getEvidenceConfidence('ingredient_intelligence'),
      polarity: 'negative',
    });
  }

  for (const concept of [
    ...fragranceProfile.families,
    ...fragranceProfile.performance,
    ...fragranceProfile.context,
  ]) {
    addEvidence(facts.has(concept) ? positiveEvidence : neutralEvidence, {
      code: `fragrance_profile_${concept}`,
      label: `Fragrance profile: ${formatLabel(concept)}`,
      detail: `Fragrance profile includes ${formatLabel(concept)}.`,
      source: 'fragrance_profile',
      domain: 'fragrance',
      confidence: getEvidenceConfidence(
        'fragrance_profile',
        input.productAnalysis?.confidence,
      ),
      polarity: facts.has(concept) ? 'positive' : 'neutral',
    });
  }

  for (const risk of fragranceProfile.risks) {
    addEvidence(negativeEvidence, {
      code: `fragrance_profile_risk_${risk}`,
      label: `Fragrance risk: ${formatLabel(risk)}`,
      detail: `Fragrance profile includes ${formatLabel(risk)} risk.`,
      source: 'fragrance_profile',
      domain: 'fragrance',
      confidence: getEvidenceConfidence(
        'fragrance_profile',
        input.productAnalysis?.confidence,
      ),
      polarity: 'negative',
    });
  }

  const missingEvidence = getMissingEvidence(input, ingredientIntelligence);
  const conflicts = getEvidenceConflicts({
    facts: new Set(facts.keys()),
    productConcepts,
    warnings,
    scoreBreakdown: input.scoreBreakdown,
  });
  const confidence = calculateConfidence({
    positiveEvidence,
    negativeEvidence,
    neutralEvidence,
    missingEvidence,
    conflicts,
    scoreBreakdown: input.scoreBreakdown,
    productAnalysis: input.productAnalysis,
  });

  return {
    confidence,
    level: getConfidenceLevel(confidence),
    positiveEvidence,
    negativeEvidence,
    neutralEvidence,
    missingEvidence,
    conflicts,
  };
}

function calculateConfidence(input: {
  positiveEvidence: EvidenceItem[];
  negativeEvidence: EvidenceItem[];
  neutralEvidence: EvidenceItem[];
  missingEvidence: string[];
  conflicts: EvidenceConflict[];
  scoreBreakdown: RecommendationScoreBreakdown;
  productAnalysis?: ProductAnalysis;
}) {
  const allEvidence = [
    ...input.positiveEvidence,
    ...input.negativeEvidence,
    ...input.neutralEvidence,
  ];
  const averageEvidenceConfidence = allEvidence.length
    ? average(allEvidence.map((item) => item.confidence))
    : 0.35;
  let confidence = averageEvidenceConfidence;

  confidence += Math.min(0.12, input.positiveEvidence.length * 0.03);
  confidence -= Math.min(0.18, input.negativeEvidence.length * 0.03);
  confidence -= Math.min(0.4, input.scoreBreakdown.blockers.length * 0.32);
  confidence -= input.conflicts.reduce(
    (sum, conflict) => sum + getConflictPenalty(conflict.severity),
    0,
  );

  for (const missing of input.missingEvidence) {
    confidence -= MISSING_EVIDENCE_PENALTIES[missing] ?? 0.05;
  }

  if (typeof input.productAnalysis?.confidence === 'number') {
    const analysisConfidence = normalizeConfidence(
      input.productAnalysis.confidence,
    );
    confidence += (analysisConfidence - 0.5) * 0.12;
  }

  return roundConfidence(clamp(confidence));
}

function getEvidenceConflicts(input: {
  facts: Set<string>;
  productConcepts: Set<string>;
  warnings: Set<string>;
  scoreBreakdown: RecommendationScoreBreakdown;
}) {
  const conflicts: EvidenceConflict[] = [];
  const positiveCodes = new Set(
    input.scoreBreakdown.positives.map((item) => item.code),
  );
  const hasFragranceMatch = input.scoreBreakdown.positives.some(
    (item) => item.domain === 'fragrance' && item.code.startsWith('matches_'),
  );

  if (
    positiveCodes.has('matches_sensitive_skin') &&
    input.warnings.has('sensitive_skin_risk')
  ) {
    conflicts.push({
      code: 'sensitive_skin_match_but_risky',
      label: 'Sensitive skin match but risky',
      detail:
        'Product matches sensitive skin but also has sensitive skin risk signals.',
      domain: 'skin',
      severity: 'high',
    });
  }

  if (hasFragranceMatch && input.warnings.has('fragrance_allergen_risk')) {
    conflicts.push({
      code: 'fragrance_match_but_allergen_risk',
      label: 'Fragrance match but allergen risk',
      detail:
        'Product matches fragrance preferences but has fragrance allergen risk signals.',
      domain: 'fragrance',
      severity: 'medium',
    });
  }

  if (
    input.facts.has('dry_hair') &&
    positiveCodes.has('supports_dry_hair') &&
    input.warnings.has('contains_sulfates')
  ) {
    conflicts.push({
      code: 'hair_moisturizing_but_sulfates',
      label: 'Moisturizing but contains sulfates',
      detail:
        'Product has moisturizing hair support but contains sulfates for a dry-hair customer.',
      domain: 'hair',
      severity: 'high',
    });
  }

  if (
    input.facts.has('office_safe') &&
    input.productConcepts.has('projection_strong')
  ) {
    conflicts.push({
      code: 'office_safe_but_strong_projection',
      label: 'Office-safe but strong projection',
      detail:
        'Customer wants office-safe fragrance but the product has strong projection.',
      domain: 'fragrance',
      severity: 'high',
    });
  }

  return conflicts;
}

function getMissingEvidence(
  input: RecommendationEvidenceInput,
  ingredientIntelligence: IngredientIntelligenceResult | undefined,
) {
  const missing: string[] = [];

  if (!input.customerFacts?.length) missing.push('no_customer_facts');
  if (!input.productTags?.length) missing.push('no_product_tags');
  if (!input.productAnalysis) missing.push('missing_product_analysis');
  if (input.productAnalysis && !ingredientIntelligence) {
    missing.push('missing_ingredient_intelligence');
  }
  if (
    typeof input.productAnalysis?.confidence === 'number' &&
    normalizeConfidence(input.productAnalysis.confidence) < 0.4
  ) {
    missing.push('low_analysis_confidence');
  }

  return missing;
}

function getEvidenceConfidence(
  source: EvidenceSource,
  ownConfidence?: unknown,
) {
  const sourceWeight = SOURCE_CONFIDENCE_WEIGHTS[source];
  const normalizedOwnConfidence = normalizeOptionalConfidence(ownConfidence);

  if (normalizedOwnConfidence === null) return sourceWeight;

  // Blend source reliability with item-level confidence so weak source data
  // cannot dominate the estimate, while ProductAnalysis/customer confidence
  // still nudges evidence up or down deterministically.
  return roundConfidence(sourceWeight * 0.65 + normalizedOwnConfidence * 0.35);
}

function getSourceConfidence(
  source: RecommendationScoreSource,
  productAnalysis: ProductAnalysis | undefined,
) {
  return source === 'product_analysis'
    ? productAnalysis?.confidence
    : undefined;
}

function toEvidenceSource(source: RecommendationScoreSource): EvidenceSource {
  return source;
}

function getWarningSource(
  warning: string,
  productAnalysis: ProductAnalysis | undefined,
  ingredientIntelligence: IngredientIntelligenceResult | undefined,
): EvidenceSource {
  if (
    ingredientIntelligence?.risks.includes(warning) ||
    ingredientIntelligence?.warnings.includes(warning)
  ) {
    return 'ingredient_intelligence';
  }

  if (getFragranceProfileConcepts(productAnalysis).risks.includes(warning)) {
    return 'fragrance_profile';
  }

  return 'product_analysis';
}

function getFactValueMap(customerFacts: CustomerFact[] | undefined) {
  const values = new Map<string, CustomerFact>();

  for (const fact of customerFacts || []) {
    for (const value of [
      (fact as CustomerFact & { normalizedKey?: string }).normalizedKey,
      fact.value,
      fact.type,
    ]) {
      const normalized = normalizeCode(value);
      if (normalized) values.set(normalized, fact);
    }
  }

  return values;
}

function getProductTagConcepts(productTags: ProductTag[] | undefined) {
  const concepts = new Map<string, ProductTag>();

  for (const tag of productTags || []) {
    for (const value of [tag.normalizedKey, tag.name]) {
      const concept = normalizeCode(value);
      if (concept) concepts.set(concept, tag);
    }
  }

  return concepts;
}

function getAnalysisConcepts(productAnalysis: ProductAnalysis | undefined) {
  const concepts = new Set<string>();

  if (!productAnalysis) return concepts;

  for (const value of [
    productAnalysis.matchedConcepts,
    productAnalysis.suitableFor,
    productAnalysis.rawAnalysis?.matchedConcepts,
    productAnalysis.rawAnalysis?.suitableFor,
  ]) {
    for (const concept of getConceptsFromValue(value)) {
      concepts.add(concept);
    }
  }

  return concepts;
}

function getWarningConcepts(
  productAnalysis: ProductAnalysis | undefined,
  ingredientIntelligence: IngredientIntelligenceResult | undefined,
) {
  const warnings = new Set<string>();

  for (const value of [
    productAnalysis?.warnings,
    productAnalysis?.rawAnalysis?.warnings,
    getFragranceProfileConcepts(productAnalysis).risks,
    ingredientIntelligence?.risks,
    ingredientIntelligence?.warnings,
  ]) {
    for (const warning of getConceptsFromValue(value)) {
      warnings.add(warning);
    }
  }

  return warnings;
}

function getFragranceProfileConcepts(
  productAnalysis: ProductAnalysis | undefined,
) {
  const fragranceProfile = productAnalysis?.rawAnalysis?.fragranceProfile;
  const empty = {
    families: [] as string[],
    performance: [] as string[],
    context: [] as string[],
    risks: [] as string[],
  };

  if (!fragranceProfile || typeof fragranceProfile !== 'object') return empty;

  const profile = fragranceProfile as Record<string, unknown>;

  return {
    families: getConceptsFromValue(profile.families),
    performance: getConceptsFromValue(profile.performance),
    context: getConceptsFromValue(profile.context),
    risks: getConceptsFromValue(profile.risks),
  };
}

function getIngredientIntelligence(
  productAnalysis: ProductAnalysis | undefined,
): IngredientIntelligenceResult | undefined {
  const value = productAnalysis?.rawAnalysis?.ingredientIntelligence;

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as IngredientIntelligenceResult;
}

function getConceptsFromValue(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .flatMap((item) => {
      if (typeof item === 'string') return [item];
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const record = item as Record<string, unknown>;
        return [record.code, record.key, record.normalizedKey, record.value];
      }
      return [];
    })
    .map((item) => normalizeCode(item))
    .filter((item): item is string => Boolean(item));
}

function addEvidence(items: EvidenceItem[], item: EvidenceItem) {
  if (
    items.some(
      (existing) =>
        existing.code === item.code &&
        existing.source === item.source &&
        existing.polarity === item.polarity,
    )
  ) {
    return;
  }

  items.push({
    ...item,
    confidence: roundConfidence(clamp(item.confidence)),
  });
}

function getOwnConfidence(value: { confidence?: unknown }) {
  return value.confidence;
}

function normalizeOptionalConfidence(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;

  return normalizeConfidence(value);
}

function normalizeConfidence(value: number) {
  if (value <= 1) return clamp(value);
  return clamp(value / 100);
}

function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.75) return 'high';
  if (confidence >= 0.45) return 'medium';
  return 'low';
}

function getConflictPenalty(severity: EvidenceConflict['severity']) {
  if (severity === 'high') return 0.2;
  if (severity === 'medium') return 0.12;
  return 0.07;
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeCode(value: unknown) {
  return normalizeDomainKey(value);
}

function formatLabel(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function roundConfidence(value: number) {
  return Math.round(value * 100) / 100;
}
