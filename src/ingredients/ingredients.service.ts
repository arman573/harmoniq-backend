import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ingredient } from './ingredient.entity';

export type IngredientIntelligenceScores = {
  hydrationBoost: number;
  barrierSupportBoost: number;
  irritationPenalty: number;
  acneRiskPenalty: number;
};

export type IngredientIntelligenceResult = {
  detectedIngredients: string[];
  knownIngredients: string[];
  unknownIngredients: string[];
  benefits: string[];
  risks: string[];
  warnings: string[];
  scores: IngredientIntelligenceScores;
};

type IngredientScoreMetadata = Partial<IngredientIntelligenceScores>;

type IngredientMetadata = {
  scores?: IngredientScoreMetadata;
  warnings?: string[];
};

type SeedIngredient = Omit<
  Ingredient,
  'id' | 'createdAt' | 'updatedAt' | 'normalizedName'
> & {
  normalizedName?: string;
  metadata?: IngredientMetadata;
};

const EMPTY_SCORES: IngredientIntelligenceScores = {
  hydrationBoost: 0,
  barrierSupportBoost: 0,
  irritationPenalty: 0,
  acneRiskPenalty: 0,
};

const INGREDIENT_SEEDS: SeedIngredient[] = [
  {
    name: 'Water',
    aliases: ['aqua'],
    benefits: [],
    risks: [],
    comedogenicRating: null,
    irritationRisk: 'low',
    fungalAcneSafe: null,
    pregnancySafe: null,
    metadata: {},
  },
  {
    name: 'Glycerin',
    aliases: [],
    benefits: ['hydration', 'barrier_support'],
    risks: [],
    comedogenicRating: null,
    irritationRisk: 'low',
    fungalAcneSafe: null,
    pregnancySafe: null,
    metadata: {
      scores: { hydrationBoost: 20 },
    },
  },
  {
    name: 'Niacinamide',
    aliases: [],
    benefits: ['barrier_support', 'oil_control', 'brightening'],
    risks: ['possible_irritation'],
    comedogenicRating: null,
    irritationRisk: 'low',
    fungalAcneSafe: null,
    pregnancySafe: null,
    metadata: {
      scores: { barrierSupportBoost: 15 },
    },
  },
  {
    name: 'Hyaluronic Acid',
    aliases: ['sodium hyaluronate', 'hyaluronic acid sodium hyaluronate'],
    benefits: ['hydration'],
    risks: [],
    comedogenicRating: null,
    irritationRisk: 'low',
    fungalAcneSafe: null,
    pregnancySafe: null,
    metadata: {
      scores: { hydrationBoost: 20 },
    },
  },
  {
    name: 'Panthenol',
    aliases: [],
    benefits: [
      'hydration',
      'barrier_support',
      'soothing',
      'strengthening_hair',
    ],
    risks: [],
    comedogenicRating: null,
    irritationRisk: 'low',
    fungalAcneSafe: null,
    pregnancySafe: null,
    metadata: {
      scores: { hydrationBoost: 15, barrierSupportBoost: 10 },
    },
  },
  {
    name: 'Ceramide NP',
    aliases: [],
    benefits: ['barrier_support'],
    risks: [],
    comedogenicRating: null,
    irritationRisk: 'low',
    fungalAcneSafe: null,
    pregnancySafe: null,
    metadata: {
      scores: { barrierSupportBoost: 25 },
    },
  },
  {
    name: 'Fragrance',
    aliases: ['parfum', 'fragrance parfum'],
    benefits: [],
    risks: [
      'fragrance',
      'irritant',
      'sensitive_skin_risk',
      'scalp_irritation_risk',
      'fragrance_allergen_risk',
      'migraine_trigger_risk',
    ],
    comedogenicRating: null,
    irritationRisk: 'high',
    fungalAcneSafe: null,
    pregnancySafe: null,
    metadata: {
      scores: { irritationPenalty: 30 },
      warnings: [
        'contains_fragrance',
        'scalp_irritation_risk',
        'fragrance_allergen_risk',
        'migraine_trigger_risk',
      ],
    },
  },
  {
    name: 'Alcohol Denat',
    aliases: ['alcohol denat.', 'denatured alcohol'],
    benefits: [],
    risks: ['drying_alcohol', 'irritant', 'sensitive_skin_risk'],
    comedogenicRating: null,
    irritationRisk: 'high',
    fungalAcneSafe: null,
    pregnancySafe: null,
    metadata: {
      scores: { irritationPenalty: 25 },
      warnings: ['contains_drying_alcohol'],
    },
  },
  {
    name: 'Salicylic Acid',
    aliases: [],
    benefits: ['exfoliation', 'oil_control'],
    risks: ['possible_irritation', 'drying'],
    comedogenicRating: null,
    irritationRisk: 'medium',
    fungalAcneSafe: null,
    pregnancySafe: null,
    metadata: {
      scores: { irritationPenalty: 10 },
    },
  },
  {
    name: 'Lactic Acid',
    aliases: [],
    benefits: ['exfoliation', 'hydration'],
    risks: ['possible_irritation'],
    comedogenicRating: null,
    irritationRisk: 'medium',
    fungalAcneSafe: null,
    pregnancySafe: null,
    metadata: {
      scores: { irritationPenalty: 10 },
    },
  },
  {
    name: 'Shea Butter',
    aliases: ['butyrospermum parkii butter'],
    benefits: ['emollient', 'moisturizing_hair'],
    risks: ['comedogenic_risk'],
    comedogenicRating: 2,
    irritationRisk: 'low',
    fungalAcneSafe: null,
    pregnancySafe: null,
    metadata: {
      scores: { acneRiskPenalty: 10 },
    },
  },
  {
    name: 'Coconut Oil',
    aliases: ['cocos nucifera oil'],
    benefits: ['emollient', 'moisturizing_hair'],
    risks: ['comedogenic_risk'],
    comedogenicRating: 4,
    irritationRisk: 'low',
    fungalAcneSafe: null,
    pregnancySafe: null,
    metadata: {
      scores: { acneRiskPenalty: 30 },
      warnings: ['comedogenic_risk'],
    },
  },
  {
    name: 'Argan Oil',
    aliases: ['argania spinosa kernel oil'],
    benefits: ['moisturizing_hair', 'frizz_control'],
    risks: [],
    comedogenicRating: null,
    irritationRisk: 'low',
    fungalAcneSafe: null,
    pregnancySafe: null,
    metadata: {},
  },
  {
    name: 'Hydrolyzed Keratin',
    aliases: [],
    benefits: ['protein_rich', 'strengthening_hair'],
    risks: [],
    comedogenicRating: null,
    irritationRisk: 'low',
    fungalAcneSafe: null,
    pregnancySafe: null,
    metadata: {},
  },
  {
    name: 'Hydrolyzed Wheat Protein',
    aliases: [],
    benefits: ['protein_rich', 'strengthening_hair'],
    risks: [],
    comedogenicRating: null,
    irritationRisk: 'low',
    fungalAcneSafe: null,
    pregnancySafe: null,
    metadata: {},
  },
  {
    name: 'Sodium Lauryl Sulfate',
    aliases: ['sls'],
    benefits: [],
    risks: [
      'contains_sulfates',
      'color_stripping_risk',
      'scalp_irritation_risk',
    ],
    comedogenicRating: null,
    irritationRisk: 'high',
    fungalAcneSafe: null,
    pregnancySafe: null,
    metadata: {
      warnings: [
        'contains_sulfates',
        'color_stripping_risk',
        'scalp_irritation_risk',
      ],
    },
  },
  {
    name: 'Sodium Laureth Sulfate',
    aliases: ['sles'],
    benefits: [],
    risks: ['contains_sulfates', 'color_stripping_risk'],
    comedogenicRating: null,
    irritationRisk: 'medium',
    fungalAcneSafe: null,
    pregnancySafe: null,
    metadata: {
      warnings: ['contains_sulfates', 'color_stripping_risk'],
    },
  },
  {
    name: 'Dimethicone',
    aliases: [],
    benefits: [],
    risks: ['contains_heavy_silicones'],
    comedogenicRating: null,
    irritationRisk: 'low',
    fungalAcneSafe: null,
    pregnancySafe: null,
    metadata: {
      warnings: ['contains_heavy_silicones'],
    },
  },
  {
    name: 'Essential Oil',
    aliases: ['essential oils'],
    benefits: [],
    risks: ['fragrance_allergen_risk', 'migraine_trigger_risk'],
    comedogenicRating: null,
    irritationRisk: 'medium',
    fungalAcneSafe: null,
    pregnancySafe: null,
    metadata: {
      warnings: ['fragrance_allergen_risk', 'migraine_trigger_risk'],
    },
  },
  {
    name: 'Limonene',
    aliases: [],
    benefits: ['citrus'],
    risks: ['fragrance_allergen_risk'],
    comedogenicRating: null,
    irritationRisk: 'medium',
    fungalAcneSafe: null,
    pregnancySafe: null,
    metadata: {
      warnings: ['fragrance_allergen_risk'],
    },
  },
  {
    name: 'Linalool',
    aliases: [],
    benefits: ['floral'],
    risks: ['fragrance_allergen_risk'],
    comedogenicRating: null,
    irritationRisk: 'medium',
    fungalAcneSafe: null,
    pregnancySafe: null,
    metadata: {
      warnings: ['fragrance_allergen_risk'],
    },
  },
  {
    name: 'Vanillin',
    aliases: [],
    benefits: ['vanilla', 'gourmand'],
    risks: [],
    comedogenicRating: null,
    irritationRisk: 'low',
    fungalAcneSafe: null,
    pregnancySafe: null,
    metadata: {},
  },
  {
    name: 'Coumarin',
    aliases: [],
    benefits: ['powdery', 'gourmand'],
    risks: ['fragrance_allergen_risk'],
    comedogenicRating: null,
    irritationRisk: 'medium',
    fungalAcneSafe: null,
    pregnancySafe: null,
    metadata: {
      warnings: ['fragrance_allergen_risk'],
    },
  },
  {
    name: 'Citronellol',
    aliases: [],
    benefits: ['floral'],
    risks: ['fragrance_allergen_risk'],
    comedogenicRating: null,
    irritationRisk: 'medium',
    fungalAcneSafe: null,
    pregnancySafe: null,
    metadata: {
      warnings: ['fragrance_allergen_risk'],
    },
  },
  {
    name: 'Mineral Oil',
    aliases: ['paraffinum liquidum'],
    benefits: ['emollient', 'occlusive'],
    risks: [],
    comedogenicRating: null,
    irritationRisk: 'low',
    fungalAcneSafe: null,
    pregnancySafe: null,
    metadata: {},
  },
];

@Injectable()
export class IngredientsService implements OnModuleInit {
  private readonly logger = new Logger(IngredientsService.name);
  private readonly builtInIngredients = INGREDIENT_SEEDS.map((ingredient) =>
    this.normalizeSeedIngredient(ingredient),
  );

  constructor(
    @InjectRepository(Ingredient)
    private readonly ingredientRepo: Repository<Ingredient>,
  ) {}

  async onModuleInit() {
    await this.seedInitialIngredients();
  }

  normalizeIngredientName(name: string): string {
    return name
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[-._/\\]+/g, ' ')
      .replace(/[()[\]{}]+/g, ' ')
      .replace(/[,:;|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  parseIngredientList(raw: string | string[]): string[] {
    const values = Array.isArray(raw) ? raw : [raw];
    const ingredients = values.flatMap((value) =>
      value
        .split(/[,;\n]+/)
        .map((ingredient) => this.normalizeIngredientName(ingredient))
        .filter(Boolean),
    );

    return this.uniqueSorted(ingredients);
  }

  matchIngredient(name: string): Ingredient | null {
    const normalizedName = this.normalizeIngredientName(name);

    return (
      this.builtInIngredients.find(
        (ingredient) =>
          ingredient.normalizedName === normalizedName ||
          ingredient.aliases.some(
            (alias) => this.normalizeIngredientName(alias) === normalizedName,
          ),
      ) ?? null
    );
  }

  analyzeIngredients(
    rawIngredients: string | string[] | null | undefined,
  ): IngredientIntelligenceResult {
    const detectedIngredients = rawIngredients
      ? this.parseIngredientList(rawIngredients)
      : [];
    const knownIngredients: string[] = [];
    const unknownIngredients: string[] = [];
    const benefits: string[] = [];
    const risks: string[] = [];
    const warnings: string[] = [];
    const scores = { ...EMPTY_SCORES };

    for (const detectedIngredient of detectedIngredients) {
      const ingredient = this.matchIngredient(detectedIngredient);

      if (!ingredient) {
        unknownIngredients.push(detectedIngredient);
        continue;
      }

      knownIngredients.push(ingredient.normalizedName);
      benefits.push(...ingredient.benefits);
      risks.push(...ingredient.risks);

      const metadata = this.getIngredientMetadata(ingredient);

      for (const warning of metadata.warnings || []) {
        warnings.push(warning);
      }

      this.addScores(scores, metadata.scores);
    }

    if (scores.irritationPenalty >= 30) {
      warnings.push('sensitive_skin_risk');
    }

    return {
      detectedIngredients,
      knownIngredients: this.uniqueSorted(knownIngredients),
      unknownIngredients: this.uniqueSorted(unknownIngredients),
      benefits: this.uniqueSorted(benefits),
      risks: this.uniqueSorted(risks),
      warnings: this.uniqueSorted(warnings),
      scores,
    };
  }

  private async seedInitialIngredients() {
    for (const ingredient of this.builtInIngredients) {
      const existing = await this.ingredientRepo.findOne({
        where: { normalizedName: ingredient.normalizedName },
      });

      if (existing) {
        await this.ingredientRepo.save({ ...existing, ...ingredient });
      } else {
        await this.ingredientRepo.save(this.ingredientRepo.create(ingredient));
      }
    }

    this.logger.log(
      `Ingredient Intelligence v1 seeded ${this.builtInIngredients.length} ingredients`,
    );
  }

  private normalizeSeedIngredient(seed: SeedIngredient): Ingredient {
    const normalizedName =
      seed.normalizedName ?? this.normalizeIngredientName(seed.name);

    return {
      ...seed,
      normalizedName,
      aliases: this.uniqueSorted(
        seed.aliases.map((alias) => this.normalizeIngredientName(alias)),
      ),
      benefits: this.uniqueSorted(seed.benefits),
      risks: this.uniqueSorted(seed.risks),
    } as Ingredient;
  }

  private getIngredientMetadata(ingredient: Ingredient): IngredientMetadata {
    const metadata = ingredient.metadata;

    if (!metadata || typeof metadata !== 'object') return {};

    return metadata;
  }

  private addScores(
    scores: IngredientIntelligenceScores,
    contribution: IngredientScoreMetadata | undefined,
  ) {
    if (!contribution) return;

    scores.hydrationBoost += contribution.hydrationBoost ?? 0;
    scores.barrierSupportBoost += contribution.barrierSupportBoost ?? 0;
    scores.irritationPenalty += contribution.irritationPenalty ?? 0;
    scores.acneRiskPenalty += contribution.acneRiskPenalty ?? 0;
  }

  private uniqueSorted(values: string[]) {
    return Array.from(new Set(values.filter(Boolean))).sort();
  }
}
