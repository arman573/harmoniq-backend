import {
  BEAUTY_DOMAINS,
  BeautyDomain,
  getDomainForKey,
  normalizeDomainKey,
  uniqueDomains,
} from '../beauty-domain';
import { IngredientIntelligenceResult } from '../ingredients/ingredients.service';
import { ProductAnalysis } from '../products/product-analysis.entity';
import { ProductTag } from '../products/product-tag.entity';
import { CustomerFact } from './customer-fact.entity';
import {
  BeautyProfileSignal,
  UnifiedBeautyProfile,
} from './unified-beauty-profile';

export type RecommendationScoreSource =
  | 'customer_fact'
  | 'customer_profile'
  | 'product_tag'
  | 'product_analysis'
  | 'ingredient_intelligence'
  | 'rule';

export type RecommendationScoreItem = {
  code: string;
  domain: BeautyDomain;
  label: string;
  impact: number;
  source: RecommendationScoreSource;
  confidence?: number;
  profileSignalKey?: string;
};

export type RecommendationBlocker = RecommendationScoreItem & {
  detail: string;
  penalty: number;
};

export type RecommendationScoreBreakdown = {
  positives: RecommendationScoreItem[];
  negatives: RecommendationScoreItem[];
  blockers: RecommendationBlocker[];
  finalScore: number;
};

export type RecommendationScoreV5Result = {
  recommendationScoreV5: number;
  domains: BeautyDomain[];
  scoreBreakdown: RecommendationScoreBreakdown;
  blocked: boolean;
  blockers: RecommendationBlocker[];
  profileAlignment: ProfileAlignment;
};

export type ProfileAlignmentSignal = {
  key: string;
  label: string;
  domain: BeautyDomain;
  confidence: number;
  impact: number;
};

export type ProfileAlignment = {
  matchedSignals: ProfileAlignmentSignal[];
  riskSignals: ProfileAlignmentSignal[];
  domainAlignment: Partial<Record<BeautyDomain, number>>;
};

type RecommendationScoringInput = {
  customerFacts?: CustomerFact[];
  unifiedBeautyProfile?: UnifiedBeautyProfile;
  productTags?: ProductTag[];
  productAnalysis?: ProductAnalysis;
  ingredientIntelligence?: IngredientIntelligenceResult;
};

type ProfileScoringContext = {
  profile?: UnifiedBeautyProfile;
  positives: RecommendationScoreItem[];
  negatives: RecommendationScoreItem[];
  profileAlignment: ProfileAlignment;
  productConcepts: Set<string>;
  warnings: Set<string>;
  benefits: Set<string>;
};

type RecommendationRuleDefinition = RecommendationScoreItem;

export const DOMAIN_RULE_CONFIG = {
  skin: {
    matches_dry_skin: {
      code: 'matches_dry_skin',
      domain: 'skin',
      label: 'Matches dry skin',
      impact: 25,
      source: 'rule',
    },
    matches_sensitive_skin: {
      code: 'matches_sensitive_skin',
      domain: 'skin',
      label: 'Matches sensitive skin',
      impact: 20,
      source: 'rule',
    },
    hydration_support: {
      code: 'hydration_support',
      domain: 'skin',
      label: 'Hydration support',
      impact: 20,
      source: 'ingredient_intelligence',
    },
    barrier_support: {
      code: 'barrier_support',
      domain: 'skin',
      label: 'Barrier support',
      impact: 15,
      source: 'ingredient_intelligence',
    },
    fragrance_free_sensitive_skin: {
      code: 'fragrance_free_sensitive_skin',
      domain: 'skin',
      label: 'Fragrance-free for sensitive skin',
      impact: 20,
      source: 'rule',
    },
    acne_safe_acne_prone: {
      code: 'acne_safe_acne_prone',
      domain: 'skin',
      label: 'Acne-safe for acne-prone skin',
      impact: 20,
      source: 'rule',
    },
    contains_fragrance: {
      code: 'contains_fragrance',
      domain: 'skin',
      label: 'Contains fragrance',
      impact: -10,
      source: 'product_analysis',
    },
    contains_drying_alcohol: {
      code: 'contains_drying_alcohol',
      domain: 'skin',
      label: 'Contains drying alcohol',
      impact: -10,
      source: 'product_analysis',
    },
    comedogenic_risk: {
      code: 'comedogenic_risk',
      domain: 'skin',
      label: 'Comedogenic risk',
      impact: -15,
      source: 'product_analysis',
    },
    sensitive_skin_risk: {
      code: 'sensitive_skin_risk',
      domain: 'skin',
      label: 'Sensitive skin risk',
      impact: -20,
      source: 'product_analysis',
    },
    contains_fragrance_sensitive_skin: {
      code: 'contains_fragrance_sensitive_skin',
      domain: 'skin',
      label: 'Fragrance risk for sensitive skin',
      impact: -40,
      source: 'rule',
    },
    drying_alcohol_dry_skin: {
      code: 'drying_alcohol_dry_skin',
      domain: 'skin',
      label: 'Drying alcohol risk for dry skin',
      impact: -35,
      source: 'rule',
    },
    drying_alcohol_sensitive_skin: {
      code: 'drying_alcohol_sensitive_skin',
      domain: 'skin',
      label: 'Drying alcohol risk for sensitive skin',
      impact: -30,
      source: 'rule',
    },
    comedogenic_risk_acne_prone: {
      code: 'comedogenic_risk_acne_prone',
      domain: 'skin',
      label: 'Comedogenic risk for acne-prone skin',
      impact: -45,
      source: 'rule',
    },
    sensitive_skin_risk_sensitive_skin: {
      code: 'sensitive_skin_risk_sensitive_skin',
      domain: 'skin',
      label: 'Sensitive skin risk',
      impact: -40,
      source: 'rule',
    },
    irritation_penalty_sensitive_skin: {
      code: 'irritation_penalty_sensitive_skin',
      domain: 'skin',
      label: 'High irritation penalty',
      impact: -35,
      source: 'ingredient_intelligence',
    },
    acne_risk_penalty_acne_prone: {
      code: 'acne_risk_penalty_acne_prone',
      domain: 'skin',
      label: 'High acne risk penalty',
      impact: -40,
      source: 'ingredient_intelligence',
    },
  },
  hair: {
    supports_dry_hair: {
      code: 'supports_dry_hair',
      domain: 'hair',
      label: 'Supports dry hair',
      impact: 25,
      source: 'rule',
    },
    dry_hair_sulfate_free: {
      code: 'dry_hair_sulfate_free',
      domain: 'hair',
      label: 'Sulfate-free for dry hair',
      impact: 15,
      source: 'rule',
    },
    supports_curly_hair: {
      code: 'supports_curly_hair',
      domain: 'hair',
      label: 'Supports curly hair',
      impact: 25,
      source: 'rule',
    },
    curly_hair_sulfate_free: {
      code: 'curly_hair_sulfate_free',
      domain: 'hair',
      label: 'Sulfate-free for curly hair',
      impact: 15,
      source: 'rule',
    },
    color_safe_support: {
      code: 'color_safe_support',
      domain: 'hair',
      label: 'Color-safe support',
      impact: 30,
      source: 'rule',
    },
    strengthening_hair_support: {
      code: 'strengthening_hair_support',
      domain: 'hair',
      label: 'Strengthening hair support',
      impact: 25,
      source: 'rule',
    },
    volumizing_fine_hair: {
      code: 'volumizing_fine_hair',
      domain: 'hair',
      label: 'Volumizing support',
      impact: 20,
      source: 'rule',
    },
    scalp_soothing_support: {
      code: 'scalp_soothing_support',
      domain: 'hair',
      label: 'Scalp soothing support',
      impact: 25,
      source: 'rule',
    },
    oily_scalp_sulfate_free: {
      code: 'oily_scalp_sulfate_free',
      domain: 'hair',
      label: 'Sulfate-free for oily scalp',
      impact: 10,
      source: 'rule',
    },
    contains_sulfates: {
      code: 'contains_sulfates',
      domain: 'hair',
      label: 'Contains sulfates',
      impact: -10,
      source: 'product_analysis',
    },
    contains_heavy_silicones: {
      code: 'contains_heavy_silicones',
      domain: 'hair',
      label: 'Contains heavy silicones',
      impact: -10,
      source: 'product_analysis',
    },
    color_stripping_risk: {
      code: 'color_stripping_risk',
      domain: 'hair',
      label: 'Color-stripping risk',
      impact: -20,
      source: 'product_analysis',
    },
    scalp_irritation_risk: {
      code: 'scalp_irritation_risk',
      domain: 'hair',
      label: 'Scalp irritation risk',
      impact: -20,
      source: 'product_analysis',
    },
    protein_overload_risk: {
      code: 'protein_overload_risk',
      domain: 'hair',
      label: 'Protein overload risk',
      impact: -15,
      source: 'product_analysis',
    },
    sulfates_dry_hair: {
      code: 'sulfates_dry_hair',
      domain: 'hair',
      label: 'Sulfate risk for dry hair',
      impact: -35,
      source: 'rule',
    },
    sulfates_curly_hair: {
      code: 'sulfates_curly_hair',
      domain: 'hair',
      label: 'Sulfate risk for curly hair',
      impact: -30,
      source: 'rule',
    },
    color_stripping_color_treated_hair: {
      code: 'color_stripping_color_treated_hair',
      domain: 'hair',
      label: 'Color-stripping risk for color-treated hair',
      impact: -45,
      source: 'rule',
    },
    scalp_irritation_sensitive_scalp: {
      code: 'scalp_irritation_sensitive_scalp',
      domain: 'hair',
      label: 'Scalp irritation risk for sensitive scalp',
      impact: -40,
      source: 'rule',
    },
    heavy_silicones_fine_hair: {
      code: 'heavy_silicones_fine_hair',
      domain: 'hair',
      label: 'Heavy silicone risk for fine hair',
      impact: -25,
      source: 'rule',
    },
    protein_rich_protein_free: {
      code: 'protein_rich_protein_free',
      domain: 'hair',
      label: 'Protein-rich product conflicts with protein-free preference',
      impact: -30,
      source: 'rule',
    },
    protein_overload_damaged_hair: {
      code: 'protein_overload_damaged_hair',
      domain: 'hair',
      label: 'Protein overload risk for damaged hair',
      impact: -20,
      source: 'rule',
    },
  },
  fragrance: {
    matches_floral: {
      code: 'matches_floral',
      domain: 'fragrance',
      label: 'Matches floral preference',
      impact: 25,
      source: 'rule',
    },
    matches_woody: {
      code: 'matches_woody',
      domain: 'fragrance',
      label: 'Matches woody preference',
      impact: 25,
      source: 'rule',
    },
    matches_citrus: {
      code: 'matches_citrus',
      domain: 'fragrance',
      label: 'Matches citrus preference',
      impact: 25,
      source: 'rule',
    },
    matches_amber: {
      code: 'matches_amber',
      domain: 'fragrance',
      label: 'Matches amber preference',
      impact: 25,
      source: 'rule',
    },
    matches_gourmand: {
      code: 'matches_gourmand',
      domain: 'fragrance',
      label: 'Matches gourmand preference',
      impact: 25,
      source: 'rule',
    },
    matches_fresh: {
      code: 'matches_fresh',
      domain: 'fragrance',
      label: 'Matches fresh preference',
      impact: 20,
      source: 'rule',
    },
    matches_musky: {
      code: 'matches_musky',
      domain: 'fragrance',
      label: 'Matches musky preference',
      impact: 20,
      source: 'rule',
    },
    matches_vanilla: {
      code: 'matches_vanilla',
      domain: 'fragrance',
      label: 'Matches vanilla preference',
      impact: 20,
      source: 'rule',
    },
    signature_scent_longevity: {
      code: 'signature_scent_longevity',
      domain: 'fragrance',
      label: 'Long-lasting signature scent',
      impact: 20,
      source: 'rule',
    },
    date_night_evening_wear: {
      code: 'date_night_evening_wear',
      domain: 'fragrance',
      label: 'Date-night evening wear',
      impact: 20,
      source: 'rule',
    },
    office_safe_projection: {
      code: 'office_safe_projection',
      domain: 'fragrance',
      label: 'Office-safe projection',
      impact: 20,
      source: 'rule',
    },
    summer_citrus_support: {
      code: 'summer_citrus_support',
      domain: 'fragrance',
      label: 'Summer citrus support',
      impact: 15,
      source: 'rule',
    },
    winter_amber_support: {
      code: 'winter_amber_support',
      domain: 'fragrance',
      label: 'Winter amber support',
      impact: 15,
      source: 'rule',
    },
    winter_woody_support: {
      code: 'winter_woody_support',
      domain: 'fragrance',
      label: 'Winter woody support',
      impact: 15,
      source: 'rule',
    },
    migraine_trigger_risk: {
      code: 'migraine_trigger_risk',
      domain: 'fragrance',
      label: 'Migraine trigger risk',
      impact: -20,
      source: 'product_analysis',
    },
    fragrance_allergen_risk: {
      code: 'fragrance_allergen_risk',
      domain: 'fragrance',
      label: 'Fragrance allergen risk',
      impact: -20,
      source: 'product_analysis',
    },
    heavy_projection_risk: {
      code: 'heavy_projection_risk',
      domain: 'fragrance',
      label: 'Heavy projection risk',
      impact: -20,
      source: 'product_analysis',
    },
    cloying_sweetness_risk: {
      code: 'cloying_sweetness_risk',
      domain: 'fragrance',
      label: 'Cloying sweetness risk',
      impact: -15,
      source: 'product_analysis',
    },
    office_projection_strong: {
      code: 'office_projection_strong',
      domain: 'fragrance',
      label: 'Strong projection for office setting',
      impact: -35,
      source: 'rule',
    },
    migraine_projection_strong: {
      code: 'migraine_projection_strong',
      domain: 'fragrance',
      label: 'Strong projection migraine risk',
      impact: -45,
      source: 'rule',
    },
    migraine_heavy_projection: {
      code: 'migraine_heavy_projection',
      domain: 'fragrance',
      label: 'Heavy projection migraine risk',
      impact: -45,
      source: 'rule',
    },
    gourmand_cloying_sweetness: {
      code: 'gourmand_cloying_sweetness',
      domain: 'fragrance',
      label: 'Cloying sweetness risk for gourmand preference',
      impact: -25,
      source: 'rule',
    },
    summer_cloying_sweetness: {
      code: 'summer_cloying_sweetness',
      domain: 'fragrance',
      label: 'Cloying sweetness risk for summer wear',
      impact: -25,
      source: 'rule',
    },
    daytime_projection_strong: {
      code: 'daytime_projection_strong',
      domain: 'fragrance',
      label: 'Strong projection for daytime wear',
      impact: -20,
      source: 'rule',
    },
  },
  nails: {},
  makeup: {},
  body: {},
  general: {},
} satisfies Record<BeautyDomain, Record<string, RecommendationRuleDefinition>>;

const BLOCKER_RULES = [
  {
    code: 'sensitive_skin_risk_blocker',
    domain: 'skin',
    label: 'Sensitive skin risk',
    detail:
      'Customer has sensitive skin and the product has sensitive skin risk signals.',
    penalty: -70,
    fact: 'sensitive_skin',
    warning: 'sensitive_skin_risk',
  },
  {
    code: 'fragrance_sensitive_skin_blocker',
    domain: 'skin',
    label: 'Fragrance risk for sensitive skin',
    detail: 'Customer has sensitive skin and the product contains fragrance.',
    penalty: -60,
    fact: 'sensitive_skin',
    warning: 'contains_fragrance',
  },
  {
    code: 'comedogenic_acne_blocker',
    domain: 'skin',
    label: 'Comedogenic risk for acne-prone skin',
    detail:
      'Customer is acne-prone and the product has comedogenic risk signals.',
    penalty: -65,
    fact: 'acne_prone',
    warning: 'comedogenic_risk',
  },
  {
    code: 'drying_alcohol_dry_skin_blocker',
    domain: 'skin',
    label: 'Drying alcohol risk for dry skin',
    detail: 'Customer has dry skin and the product contains drying alcohol.',
    penalty: -60,
    fact: 'dry_skin',
    warning: 'contains_drying_alcohol',
  },
  {
    code: 'color_stripping_blocker',
    domain: 'hair',
    label: 'Color-stripping risk',
    detail:
      'Customer has color-treated hair and the product has color-stripping risk signals.',
    penalty: -70,
    fact: 'color_treated_hair',
    warning: 'color_stripping_risk',
  },
  {
    code: 'scalp_irritation_blocker',
    domain: 'hair',
    label: 'Scalp irritation risk',
    detail:
      'Customer has a sensitive scalp and the product has scalp irritation risk signals.',
    penalty: -65,
    fact: 'sensitive_scalp',
    warning: 'scalp_irritation_risk',
  },
  {
    code: 'sulfate_dry_hair_blocker',
    domain: 'hair',
    label: 'Sulfate risk for dry hair',
    detail: 'Customer has dry hair and the product contains sulfates.',
    penalty: -60,
    fact: 'dry_hair',
    warning: 'contains_sulfates',
  },
  {
    code: 'sulfate_curly_hair_blocker',
    domain: 'hair',
    label: 'Sulfate risk for curly hair',
    detail: 'Customer has curly hair and the product contains sulfates.',
    penalty: -55,
    fact: 'curly_hair',
    warning: 'contains_sulfates',
  },
  {
    code: 'migraine_heavy_projection_blocker',
    domain: 'fragrance',
    label: 'Heavy projection migraine risk',
    detail:
      'Customer has migraine trigger risk and the product has heavy projection risk signals.',
    penalty: -70,
    fact: 'migraine_trigger_risk',
    warning: 'heavy_projection_risk',
  },
  {
    code: 'office_projection_blocker',
    domain: 'fragrance',
    label: 'Strong projection for office setting',
    detail:
      'Customer wants an office-safe fragrance and the product has strong projection.',
    penalty: -55,
    fact: 'office_safe',
    warning: 'projection_strong',
  },
  {
    code: 'fragrance_allergen_blocker',
    domain: 'fragrance',
    label: 'Fragrance allergen risk',
    detail:
      'Customer has fragrance allergen risk and the product has allergen risk signals.',
    penalty: -65,
    fact: 'fragrance_allergen_risk',
    warning: 'fragrance_allergen_risk',
  },
] as const;

export function calculateRecommendationScoreV5(
  input: RecommendationScoringInput,
): RecommendationScoreV5Result {
  const facts = getFactValues(input.customerFacts);
  const productTags = getProductTagConcepts(input.productTags);
  const analysisConcepts = getAnalysisConcepts(input.productAnalysis);
  const warnings = getWarningConcepts(
    input.productAnalysis,
    input.ingredientIntelligence,
  );
  const ingredientIntelligence =
    input.ingredientIntelligence ??
    getIngredientIntelligence(input.productAnalysis);
  const benefits = new Set(ingredientIntelligence?.benefits || []);
  const risks = new Set(ingredientIntelligence?.risks || []);
  const scores = ingredientIntelligence?.scores;
  const positives: RecommendationScoreItem[] = [];
  const negatives: RecommendationScoreItem[] = [];
  const blockers: RecommendationBlocker[] = [];
  const profileAlignment = createEmptyProfileAlignment();
  const productConcepts = new Set([
    ...productTags.keys(),
    ...analysisConcepts,
    ...warnings,
    ...benefits,
    ...risks,
  ]);
  const signalDomains = getSignalDomains({
    customerFacts: input.customerFacts,
    productTags: input.productTags,
    analysisConcepts,
    warnings,
    ingredientIntelligence,
  });
  const skinRules = DOMAIN_RULE_CONFIG.skin;
  const hairRules = DOMAIN_RULE_CONFIG.hair;
  const fragranceRules = DOMAIN_RULE_CONFIG.fragrance;

  if (facts.has('dry_skin') && productConcepts.has('dry_skin')) {
    addScoreItem(positives, {
      ...skinRules.matches_dry_skin,
      source: productTags.has('dry_skin') ? 'product_tag' : 'product_analysis',
    });
  }

  if (facts.has('sensitive_skin') && productConcepts.has('sensitive_skin')) {
    addScoreItem(positives, {
      ...skinRules.matches_sensitive_skin,
      source: productTags.has('sensitive_skin')
        ? 'product_tag'
        : 'product_analysis',
    });
  }

  if (benefits.has('hydration')) {
    addScoreItem(positives, {
      ...skinRules.hydration_support,
    });
  }

  if (benefits.has('barrier_support')) {
    addScoreItem(positives, {
      ...skinRules.barrier_support,
    });
  }

  if (facts.has('sensitive_skin') && productConcepts.has('fragrance_free')) {
    addScoreItem(positives, {
      ...skinRules.fragrance_free_sensitive_skin,
      source: productTags.has('fragrance_free')
        ? 'product_tag'
        : 'product_analysis',
    });
  }

  if (facts.has('acne_prone') && productConcepts.has('acne_safe')) {
    addScoreItem(positives, {
      ...skinRules.acne_safe_acne_prone,
      source: productTags.has('acne_safe') ? 'product_tag' : 'product_analysis',
    });
  }

  for (const warning of [
    'contains_fragrance',
    'contains_drying_alcohol',
    'comedogenic_risk',
    'sensitive_skin_risk',
  ] as const) {
    if (!warnings.has(warning)) continue;

    addScoreItem(negatives, {
      ...skinRules[warning],
      source: getWarningSource(
        warning,
        input.productAnalysis,
        input.ingredientIntelligence,
      ),
    });
  }

  if (facts.has('sensitive_skin') && warnings.has('contains_fragrance')) {
    addScoreItem(negatives, {
      ...skinRules.contains_fragrance_sensitive_skin,
    });
  }

  if (facts.has('dry_skin') && warnings.has('contains_drying_alcohol')) {
    addScoreItem(negatives, {
      ...skinRules.drying_alcohol_dry_skin,
    });
  }

  if (facts.has('sensitive_skin') && warnings.has('contains_drying_alcohol')) {
    addScoreItem(negatives, {
      ...skinRules.drying_alcohol_sensitive_skin,
    });
  }

  if (facts.has('acne_prone') && warnings.has('comedogenic_risk')) {
    addScoreItem(negatives, {
      ...skinRules.comedogenic_risk_acne_prone,
    });
  }

  if (facts.has('sensitive_skin') && warnings.has('sensitive_skin_risk')) {
    addScoreItem(negatives, {
      ...skinRules.sensitive_skin_risk_sensitive_skin,
    });
  }

  if (
    facts.has('sensitive_skin') &&
    typeof scores?.irritationPenalty === 'number' &&
    scores.irritationPenalty >= 30
  ) {
    addScoreItem(negatives, {
      ...skinRules.irritation_penalty_sensitive_skin,
    });
  }

  if (
    facts.has('acne_prone') &&
    typeof scores?.acneRiskPenalty === 'number' &&
    scores.acneRiskPenalty >= 30
  ) {
    addScoreItem(negatives, {
      ...skinRules.acne_risk_penalty_acne_prone,
    });
  }

  if (facts.has('dry_hair') && productConcepts.has('moisturizing_hair')) {
    addScoreItem(positives, {
      ...hairRules.supports_dry_hair,
      source: getProductSignalSource(
        'moisturizing_hair',
        productTags,
        analysisConcepts,
        benefits,
        risks,
      ),
    });
  }

  if (facts.has('dry_hair') && productConcepts.has('sulfate_free')) {
    addScoreItem(positives, {
      ...hairRules.dry_hair_sulfate_free,
      source: getProductSignalSource(
        'sulfate_free',
        productTags,
        analysisConcepts,
        benefits,
        risks,
      ),
    });
  }

  if (facts.has('curly_hair') && productConcepts.has('curl_defining')) {
    addScoreItem(positives, {
      ...hairRules.supports_curly_hair,
      source: getProductSignalSource(
        'curl_defining',
        productTags,
        analysisConcepts,
        benefits,
        risks,
      ),
    });
  }

  if (facts.has('curly_hair') && productConcepts.has('sulfate_free')) {
    addScoreItem(positives, {
      ...hairRules.curly_hair_sulfate_free,
      source: getProductSignalSource(
        'sulfate_free',
        productTags,
        analysisConcepts,
        benefits,
        risks,
      ),
    });
  }

  if (facts.has('color_treated_hair') && productConcepts.has('color_safe')) {
    addScoreItem(positives, {
      ...hairRules.color_safe_support,
      source: getProductSignalSource(
        'color_safe',
        productTags,
        analysisConcepts,
        benefits,
        risks,
      ),
    });
  }

  if (facts.has('damaged_hair') && productConcepts.has('strengthening_hair')) {
    addScoreItem(positives, {
      ...hairRules.strengthening_hair_support,
      source: getProductSignalSource(
        'strengthening_hair',
        productTags,
        analysisConcepts,
        benefits,
        risks,
      ),
    });
  }

  if (facts.has('fine_hair') && productConcepts.has('volumizing')) {
    addScoreItem(positives, {
      ...hairRules.volumizing_fine_hair,
      source: getProductSignalSource(
        'volumizing',
        productTags,
        analysisConcepts,
        benefits,
        risks,
      ),
    });
  }

  if (facts.has('sensitive_scalp') && productConcepts.has('scalp_soothing')) {
    addScoreItem(positives, {
      ...hairRules.scalp_soothing_support,
      source: getProductSignalSource(
        'scalp_soothing',
        productTags,
        analysisConcepts,
        benefits,
        risks,
      ),
    });
  }

  if (facts.has('oily_scalp') && productConcepts.has('sulfate_free')) {
    addScoreItem(positives, {
      ...hairRules.oily_scalp_sulfate_free,
      source: getProductSignalSource(
        'sulfate_free',
        productTags,
        analysisConcepts,
        benefits,
        risks,
      ),
    });
  }

  for (const warning of [
    'contains_sulfates',
    'contains_heavy_silicones',
    'color_stripping_risk',
    'scalp_irritation_risk',
    'protein_overload_risk',
  ] as const) {
    if (!warnings.has(warning)) continue;

    addScoreItem(negatives, {
      ...hairRules[warning],
      source: getWarningSource(
        warning,
        input.productAnalysis,
        input.ingredientIntelligence,
      ),
    });
  }

  if (facts.has('dry_hair') && warnings.has('contains_sulfates')) {
    addScoreItem(negatives, {
      ...hairRules.sulfates_dry_hair,
    });
  }

  if (facts.has('curly_hair') && warnings.has('contains_sulfates')) {
    addScoreItem(negatives, {
      ...hairRules.sulfates_curly_hair,
    });
  }

  if (facts.has('color_treated_hair') && warnings.has('color_stripping_risk')) {
    addScoreItem(negatives, {
      ...hairRules.color_stripping_color_treated_hair,
    });
  }

  if (facts.has('sensitive_scalp') && warnings.has('scalp_irritation_risk')) {
    addScoreItem(negatives, {
      ...hairRules.scalp_irritation_sensitive_scalp,
    });
  }

  if (facts.has('fine_hair') && warnings.has('contains_heavy_silicones')) {
    addScoreItem(negatives, {
      ...hairRules.heavy_silicones_fine_hair,
    });
  }

  if (facts.has('protein_free') && productConcepts.has('protein_rich')) {
    addScoreItem(negatives, {
      ...hairRules.protein_rich_protein_free,
    });
  }

  if (facts.has('damaged_hair') && warnings.has('protein_overload_risk')) {
    addScoreItem(negatives, {
      ...hairRules.protein_overload_damaged_hair,
    });
  }

  for (const family of [
    ['floral', 'matches_floral'],
    ['woody', 'matches_woody'],
    ['citrus', 'matches_citrus'],
    ['amber', 'matches_amber'],
    ['gourmand', 'matches_gourmand'],
    ['fresh', 'matches_fresh'],
    ['musky', 'matches_musky'],
    ['vanilla', 'matches_vanilla'],
  ] as const) {
    const [concept, ruleCode] = family;
    if (!facts.has(concept) || !productConcepts.has(concept)) continue;

    addScoreItem(positives, {
      ...fragranceRules[ruleCode],
      source: getProductSignalSource(
        concept,
        productTags,
        analysisConcepts,
        benefits,
        risks,
      ),
    });
  }

  if (facts.has('signature_scent') && productConcepts.has('longevity_high')) {
    addScoreItem(positives, {
      ...fragranceRules.signature_scent_longevity,
      source: getProductSignalSource(
        'longevity_high',
        productTags,
        analysisConcepts,
        benefits,
        risks,
      ),
    });
  }

  if (facts.has('date_night') && productConcepts.has('evening_wear')) {
    addScoreItem(positives, {
      ...fragranceRules.date_night_evening_wear,
      source: getProductSignalSource(
        'evening_wear',
        productTags,
        analysisConcepts,
        benefits,
        risks,
      ),
    });
  }

  if (facts.has('office_safe') && productConcepts.has('projection_soft')) {
    addScoreItem(positives, {
      ...fragranceRules.office_safe_projection,
      source: getProductSignalSource(
        'projection_soft',
        productTags,
        analysisConcepts,
        benefits,
        risks,
      ),
    });
  }

  if (facts.has('summer_fragrance') && productConcepts.has('citrus')) {
    addScoreItem(positives, {
      ...fragranceRules.summer_citrus_support,
      source: getProductSignalSource(
        'citrus',
        productTags,
        analysisConcepts,
        benefits,
        risks,
      ),
    });
  }

  if (facts.has('winter_fragrance') && productConcepts.has('amber')) {
    addScoreItem(positives, {
      ...fragranceRules.winter_amber_support,
      source: getProductSignalSource(
        'amber',
        productTags,
        analysisConcepts,
        benefits,
        risks,
      ),
    });
  }

  if (facts.has('winter_fragrance') && productConcepts.has('woody')) {
    addScoreItem(positives, {
      ...fragranceRules.winter_woody_support,
      source: getProductSignalSource(
        'woody',
        productTags,
        analysisConcepts,
        benefits,
        risks,
      ),
    });
  }

  for (const warning of [
    'migraine_trigger_risk',
    'fragrance_allergen_risk',
    'heavy_projection_risk',
    'cloying_sweetness_risk',
  ] as const) {
    if (!warnings.has(warning)) continue;

    addScoreItem(negatives, {
      ...fragranceRules[warning],
      source: getWarningSource(
        warning,
        input.productAnalysis,
        input.ingredientIntelligence,
      ),
    });
  }

  if (facts.has('office_safe') && productConcepts.has('projection_strong')) {
    addScoreItem(negatives, {
      ...fragranceRules.office_projection_strong,
    });
  }

  if (
    facts.has('migraine_trigger_risk') &&
    productConcepts.has('projection_strong')
  ) {
    addScoreItem(negatives, {
      ...fragranceRules.migraine_projection_strong,
    });
  }

  if (
    facts.has('migraine_trigger_risk') &&
    warnings.has('heavy_projection_risk')
  ) {
    addScoreItem(negatives, {
      ...fragranceRules.migraine_heavy_projection,
    });
  }

  if (facts.has('gourmand') && warnings.has('cloying_sweetness_risk')) {
    addScoreItem(negatives, {
      ...fragranceRules.gourmand_cloying_sweetness,
    });
  }

  if (facts.has('summer_fragrance') && warnings.has('cloying_sweetness_risk')) {
    addScoreItem(negatives, {
      ...fragranceRules.summer_cloying_sweetness,
    });
  }

  if (facts.has('daytime_wear') && productConcepts.has('projection_strong')) {
    addScoreItem(negatives, {
      ...fragranceRules.daytime_projection_strong,
    });
  }

  applyProfileAwareScoring({
    profile: input.unifiedBeautyProfile,
    positives,
    negatives,
    profileAlignment,
    productConcepts,
    warnings,
    benefits,
  });

  for (const rule of BLOCKER_RULES) {
    if (!facts.has(rule.fact) || !warnings.has(rule.warning)) continue;

    blockers.push({
      code: rule.code,
      domain: rule.domain,
      label: rule.label,
      detail: rule.detail,
      penalty: rule.penalty,
      impact: rule.penalty,
      source: 'rule',
    });
  }

  const finalScore = [...positives, ...negatives, ...blockers].reduce(
    (sum, item) => sum + item.impact,
    0,
  );
  const scoreBreakdown = {
    positives,
    negatives,
    blockers,
    finalScore,
  };

  return {
    recommendationScoreV5: finalScore,
    domains: getRecommendationDomains({ scoreBreakdown, signalDomains }),
    scoreBreakdown,
    blocked: blockers.length > 0,
    blockers,
    profileAlignment,
  };
}

function applyProfileAwareScoring(input: ProfileScoringContext) {
  if (!input.profile) return;

  addProfilePositive(input, {
    signalKey: 'dry_skin',
    code: 'profile_match_dry_skin',
    label: 'Profile match: dry skin',
    baseImpact: 15,
    domain: 'skin',
    matchesProduct:
      input.productConcepts.has('dry_skin') ||
      input.productConcepts.has('hydration_support') ||
      input.benefits.has('hydration'),
  });

  addProfilePositive(input, {
    signalKey: 'sensitive_skin',
    code: 'profile_match_sensitive_skin',
    label: 'Profile match: sensitive skin',
    baseImpact: 15,
    domain: 'skin',
    matchesProduct: input.productConcepts.has('sensitive_skin'),
  });

  addProfilePositive(input, {
    signalKey: 'dry_hair',
    code: 'profile_match_dry_hair',
    label: 'Profile match: dry hair',
    baseImpact: 15,
    domain: 'hair',
    matchesProduct: input.productConcepts.has('moisturizing_hair'),
  });

  addProfilePositive(input, {
    signalKey: 'sulfate_free',
    code: 'profile_match_sulfate_free',
    label: 'Profile match: sulfate-free',
    baseImpact: 10,
    domain: 'hair',
    matchesProduct: input.productConcepts.has('sulfate_free'),
  });

  addProfilePositive(input, {
    signalKey: 'floral',
    code: 'profile_match_floral',
    label: 'Profile match: floral',
    baseImpact: 15,
    domain: 'fragrance',
    matchesProduct: input.productConcepts.has('floral'),
  });

  addProfilePositive(input, {
    signalKey: 'office_safe',
    code: 'profile_match_office_safe_projection',
    label: 'Profile match: office-safe projection',
    baseImpact: 10,
    domain: 'fragrance',
    matchesProduct: input.productConcepts.has('projection_soft'),
  });

  addProfileNegative(input, {
    signalKey: 'sensitive_skin',
    code: 'profile_risk_sensitive_skin_fragrance',
    label: 'Profile risk: sensitive skin fragrance',
    baseImpact: -20,
    domain: 'skin',
    conflictsWithProduct: input.warnings.has('contains_fragrance'),
  });

  addProfileNegative(input, {
    signalKey: 'sensitive_skin',
    code: 'profile_risk_sensitive_skin',
    label: 'Profile risk: sensitive skin',
    baseImpact: -20,
    domain: 'skin',
    conflictsWithProduct: input.warnings.has('sensitive_skin_risk'),
  });

  addProfileNegative(input, {
    signalKey: 'acne_prone',
    code: 'profile_risk_acne_prone',
    label: 'Profile risk: acne prone',
    baseImpact: -20,
    domain: 'skin',
    conflictsWithProduct: input.warnings.has('comedogenic_risk'),
  });

  addProfileNegative(input, {
    signalKey: 'dry_hair',
    code: 'profile_risk_dry_hair_sulfates',
    label: 'Profile risk: dry hair sulfates',
    baseImpact: -20,
    domain: 'hair',
    conflictsWithProduct: input.warnings.has('contains_sulfates'),
  });

  addProfileNegative(input, {
    signalKey: 'sensitive_scalp',
    code: 'profile_risk_sensitive_scalp',
    label: 'Profile risk: sensitive scalp',
    baseImpact: -20,
    domain: 'hair',
    conflictsWithProduct: input.warnings.has('scalp_irritation_risk'),
  });

  addProfileNegative(input, {
    signalKey: 'migraine_trigger_risk',
    code: 'profile_risk_migraine_heavy_projection',
    label: 'Profile risk: migraine trigger',
    baseImpact: -25,
    domain: 'fragrance',
    conflictsWithProduct: input.warnings.has('heavy_projection_risk'),
  });

  addProfileNegative(input, {
    signalKey: 'fragrance_allergen_risk',
    code: 'profile_risk_fragrance_allergen',
    label: 'Profile risk: fragrance allergen',
    baseImpact: -25,
    domain: 'fragrance',
    conflictsWithProduct: input.warnings.has('fragrance_allergen_risk'),
  });
}

function addProfilePositive(
  input: ProfileScoringContext,
  rule: {
    signalKey: string;
    code: string;
    label: string;
    baseImpact: number;
    domain: BeautyDomain;
    matchesProduct: boolean;
  },
) {
  if (!rule.matchesProduct) return;

  const signal = getProfileSignal(input.profile, rule.signalKey);
  if (!signal) return;

  const impact = getProfilePositiveImpact(
    rule.baseImpact,
    signal,
    input.profile,
  );
  if (impact <= 0) return;

  addScoreItem(input.positives, {
    code: rule.code,
    domain: rule.domain,
    label: rule.label,
    impact,
    source: 'customer_profile',
    confidence: signal.confidence,
    profileSignalKey: signal.key,
  });
  addProfileAlignmentSignal(
    input.profileAlignment,
    'matchedSignals',
    signal,
    impact,
  );
}

function addProfileNegative(
  input: ProfileScoringContext,
  rule: {
    signalKey: string;
    code: string;
    label: string;
    baseImpact: number;
    domain: BeautyDomain;
    conflictsWithProduct: boolean;
  },
) {
  if (!rule.conflictsWithProduct) return;

  const signal = getProfileSignal(input.profile, rule.signalKey);
  if (!signal) return;

  const impact = getProfileNegativeImpact(rule.baseImpact, signal);

  addScoreItem(input.negatives, {
    code: rule.code,
    domain: rule.domain,
    label: rule.label,
    impact,
    source: 'customer_profile',
    confidence: signal.confidence,
    profileSignalKey: signal.key,
  });
  addProfileAlignmentSignal(
    input.profileAlignment,
    'riskSignals',
    signal,
    impact,
  );
}

function getProfilePositiveImpact(
  baseImpact: number,
  signal: BeautyProfileSignal,
  profile: UnifiedBeautyProfile | undefined,
) {
  const domainConfidence = profile?.domains[signal.domain].confidence ?? 0;
  const domainMultiplier = domainConfidence < 0.45 ? 0.75 : 1;

  return Math.round(baseImpact * signal.confidence * domainMultiplier);
}

function getProfileNegativeImpact(
  baseImpact: number,
  signal: BeautyProfileSignal,
) {
  const scaledImpact = Math.round(
    baseImpact * Math.max(signal.confidence, 0.75),
  );

  return Math.min(-10, scaledImpact);
}

function getProfileSignal(
  profile: UnifiedBeautyProfile | undefined,
  key: string,
) {
  const normalizedKey = normalizeCode(key);
  if (!profile || !normalizedKey) return null;

  for (const domain of BEAUTY_DOMAINS) {
    const signal = profile.domains[domain].signals.find(
      (candidate) => candidate.key === normalizedKey,
    );
    if (signal) return signal;
  }

  return null;
}

function createEmptyProfileAlignment(): ProfileAlignment {
  return {
    matchedSignals: [],
    riskSignals: [],
    domainAlignment: {},
  };
}

function addProfileAlignmentSignal(
  profileAlignment: ProfileAlignment,
  key: 'matchedSignals' | 'riskSignals',
  signal: BeautyProfileSignal,
  impact: number,
) {
  if (
    !profileAlignment[key].some(
      (existing) => existing.key === signal.key && existing.impact === impact,
    )
  ) {
    profileAlignment[key].push({
      key: signal.key,
      label: signal.label,
      domain: signal.domain,
      confidence: signal.confidence,
      impact,
    });
  }

  profileAlignment.domainAlignment[signal.domain] =
    (profileAlignment.domainAlignment[signal.domain] ?? 0) + impact;
}

export function getFactDomain(fact: CustomerFact): BeautyDomain {
  const explicitDomain = getExplicitDomain(
    (fact as CustomerFact & { domain?: unknown }).domain,
  );
  if (explicitDomain) return explicitDomain;

  for (const value of [
    (fact as CustomerFact & { normalizedKey?: string }).normalizedKey,
    fact.value,
    fact.type,
  ]) {
    const domain = getDomainForKey(value);
    if (domain !== 'general') return domain;
  }

  return 'general';
}

export function getProductTagDomain(tag: ProductTag): BeautyDomain {
  const explicitDomain = getExplicitDomain(tag.domain);
  if (explicitDomain) return explicitDomain;

  for (const value of [tag.normalizedKey, tag.name]) {
    const domain = getDomainForKey(value);
    if (domain !== 'general') return domain;
  }

  return 'general';
}

export function getRuleDomain(rule: { code?: string; domain?: unknown }) {
  const explicitDomain = getExplicitDomain(rule.domain);
  if (explicitDomain) return explicitDomain;

  return getDomainForKey(rule.code);
}

export function getRecommendationDomains(result: {
  domains?: BeautyDomain[];
  signalDomains?: Set<BeautyDomain> | BeautyDomain[];
  scoreBreakdown?: Partial<RecommendationScoreBreakdown>;
}): BeautyDomain[] {
  const domains: BeautyDomain[] = [];

  if (Array.isArray(result.domains)) {
    domains.push(...result.domains);
  }

  if (result.signalDomains instanceof Set) {
    domains.push(...result.signalDomains);
  } else if (Array.isArray(result.signalDomains)) {
    domains.push(...result.signalDomains);
  }

  for (const item of [
    ...(result.scoreBreakdown?.positives || []),
    ...(result.scoreBreakdown?.negatives || []),
    ...(result.scoreBreakdown?.blockers || []),
  ]) {
    domains.push(getRuleDomain(item));
  }

  const normalizedDomains = uniqueDomains(domains);

  if (normalizedDomains.length > 1) {
    return normalizedDomains.filter((domain) => domain !== 'general');
  }

  return normalizedDomains.length ? normalizedDomains : ['general'];
}

function addScoreItem<T extends RecommendationScoreItem>(items: T[], item: T) {
  if (items.some((existing) => existing.code === item.code)) return;

  items.push(item);
}

function getSignalDomains(input: {
  customerFacts?: CustomerFact[];
  productTags?: ProductTag[];
  analysisConcepts: Set<string>;
  warnings: Set<string>;
  ingredientIntelligence?: IngredientIntelligenceResult;
}) {
  const domains = new Set<BeautyDomain>();

  for (const fact of input.customerFacts || []) {
    domains.add(getFactDomain(fact));
  }

  for (const tag of input.productTags || []) {
    domains.add(getProductTagDomain(tag));
  }

  for (const value of [
    ...input.analysisConcepts,
    ...input.warnings,
    ...(input.ingredientIntelligence?.benefits || []),
    ...(input.ingredientIntelligence?.risks || []),
  ]) {
    domains.add(getDomainForKey(value));
  }

  return domains;
}

function getFactValues(customerFacts: CustomerFact[] | undefined) {
  const values = new Set<string>();

  for (const fact of customerFacts || []) {
    for (const value of [
      (fact as CustomerFact & { normalizedKey?: string }).normalizedKey,
      fact.type,
      fact.value,
    ]) {
      const normalized = normalizeCode(value);
      if (normalized) values.add(normalized);
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

  const fragranceProfile = productAnalysis.rawAnalysis?.fragranceProfile;
  if (fragranceProfile && typeof fragranceProfile === 'object') {
    const profile = fragranceProfile as Record<string, unknown>;

    for (const value of [
      profile.families,
      profile.performance,
      profile.context,
      profile.risks,
    ]) {
      for (const concept of getConceptsFromValue(value)) {
        concepts.add(concept);
      }
    }
  }

  return concepts;
}

function getWarningConcepts(
  productAnalysis: ProductAnalysis | undefined,
  ingredientIntelligence: IngredientIntelligenceResult | undefined,
) {
  const warnings = new Set<string>();
  const resolvedIngredientIntelligence =
    ingredientIntelligence ?? getIngredientIntelligence(productAnalysis);

  for (const value of [
    productAnalysis?.warnings,
    productAnalysis?.rawAnalysis?.warnings,
    getFragranceProfileRisks(productAnalysis),
    resolvedIngredientIntelligence?.risks,
    resolvedIngredientIntelligence?.warnings,
  ]) {
    for (const warning of getConceptsFromValue(value)) {
      warnings.add(warning);
    }
  }

  return warnings;
}

function getFragranceProfileRisks(
  productAnalysis: ProductAnalysis | undefined,
) {
  const fragranceProfile = productAnalysis?.rawAnalysis?.fragranceProfile;
  if (!fragranceProfile || typeof fragranceProfile !== 'object') return [];

  return (fragranceProfile as Record<string, unknown>).risks;
}

function getProductSignalSource(
  concept: string,
  productTags: Map<string, ProductTag>,
  analysisConcepts: Set<string>,
  benefits: Set<string>,
  risks: Set<string>,
): RecommendationScoreSource {
  if (productTags.has(concept)) return 'product_tag';
  if (benefits.has(concept) || risks.has(concept)) {
    return 'ingredient_intelligence';
  }
  if (analysisConcepts.has(concept)) return 'product_analysis';

  return 'rule';
}

function getWarningSource(
  warning: string,
  productAnalysis: ProductAnalysis | undefined,
  ingredientIntelligence: IngredientIntelligenceResult | undefined,
): RecommendationScoreSource {
  const resolvedIngredientIntelligence =
    ingredientIntelligence ?? getIngredientIntelligence(productAnalysis);
  const ingredientWarnings = new Set([
    ...getConceptsFromValue(resolvedIngredientIntelligence?.risks),
    ...getConceptsFromValue(resolvedIngredientIntelligence?.warnings),
  ]);

  if (ingredientWarnings.has(warning)) {
    return 'ingredient_intelligence';
  }

  return 'product_analysis';
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

function normalizeCode(value: unknown) {
  return normalizeDomainKey(value);
}

function getExplicitDomain(value: unknown): BeautyDomain | null {
  return typeof value === 'string' &&
    BEAUTY_DOMAINS.includes(value as BeautyDomain)
    ? (value as BeautyDomain)
    : null;
}
