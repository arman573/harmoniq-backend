import { createHash } from 'node:crypto';
import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import OpenAI from 'openai';
import { Repository } from 'typeorm';
import {
  ExplainabilityService,
  ProductExplanation,
} from '../explainability/explainability.service';
import {
  IngredientIntelligenceResult,
  IngredientsService,
} from '../ingredients/ingredients.service';
import { TaxonomyTag } from '../taxonomy/taxonomy-tag.entity';
import { ProductAnalysis } from './product-analysis.entity';
import { Product } from './product.entity';

type ProductAnalysisScores = {
  hydrationScore: number;
  acneSafetyScore: number;
  sensitiveSafetyScore: number;
};

type OpenAiProductAnalysis = {
  warnings: string[];
  matchedConcepts: string[];
  scores: ProductAnalysisScores;
  confidence: number;
  ingredients: string[];
};

type TaxonomyConcept = {
  normalizedKey: string;
  name: string;
  domain?: string;
  kind?: string;
  synonyms?: string[];
};

const ANALYSIS_SOURCE = 'openai-inci-v1';
const DEFAULT_OPENAI_MODEL = 'gpt-5.4-mini';
const MAX_TAXONOMY_CONCEPTS = 500;
const PRODUCT_ANALYSIS_SCORE_KEYS = [
  'hydrationScore',
  'acneSafetyScore',
  'sensitiveSafetyScore',
] as const;

const PRODUCT_ANALYSIS_RESPONSE_FORMAT = {
  type: 'json_schema',
  name: 'product_analysis',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'warnings',
      'matchedConcepts',
      'scores',
      'confidence',
      'ingredients',
    ],
    properties: {
      warnings: {
        type: 'array',
        items: { type: 'string' },
      },
      matchedConcepts: {
        type: 'array',
        items: { type: 'string' },
      },
      scores: {
        type: 'object',
        additionalProperties: false,
        required: ['hydrationScore', 'acneSafetyScore', 'sensitiveSafetyScore'],
        properties: {
          hydrationScore: { type: 'number' },
          acneSafetyScore: { type: 'number' },
          sensitiveSafetyScore: { type: 'number' },
        },
      },
      confidence: { type: 'number' },
      ingredients: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  },
} as const;

@Injectable()
export class ProductAnalysisService {
  private readonly logger = new Logger(ProductAnalysisService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductAnalysis)
    private readonly analysisRepo: Repository<ProductAnalysis>,
    @InjectRepository(TaxonomyTag)
    private readonly taxonomyTagRepo: Repository<TaxonomyTag>,
    private readonly ingredientsService: IngredientsService,
    private readonly explainabilityService: ExplainabilityService,
  ) {}

  async analyzeProduct(productId: number) {
    const product = await this.productRepo.findOne({
      where: { id: productId },
      relations: { specs: true, tags: true, analyses: true },
    });

    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    const extractedIngredients = this.extractIngredients(product);
    const ingredientIntelligence =
      this.ingredientsService.analyzeIngredients(extractedIngredients);
    const normalizedPayload = this.buildNormalizedAnalysisPayload(
      product,
      ingredientIntelligence.detectedIngredients,
    );
    const analysisHash = this.hashAnalysisPayload(normalizedPayload);
    const latestAnalysis = await this.findLatestAnalysis(product.id);

    if (latestAnalysis?.analysisHash === analysisHash) {
      if (this.isCacheableAnalysis(latestAnalysis)) {
        this.logger.log(
          `Product ${product.id} analysis cache hit for hash ${this.shortHash(
            analysisHash,
          )}`,
        );

        const explanation = this.generateExplanation(
          product,
          latestAnalysis,
          ingredientIntelligence,
        );

        return { cached: true, analysis: latestAnalysis, explanation };
      }

      this.logger.warn(
        `Product ${product.id} analysis cache miss: matching hash has missing or corrupt analysis data`,
      );
    } else if (latestAnalysis) {
      this.logger.log(`Product ${product.id} analysis cache miss`);

      if (latestAnalysis.analysisHash) {
        this.logger.log(
          `Product ${product.id} analysis hash changed (${this.shortHash(
            latestAnalysis.analysisHash,
          )} -> ${this.shortHash(analysisHash)})`,
        );
      } else {
        this.logger.log(
          `Product ${product.id} analysis cache miss: latest analysis has no hash`,
        );
      }
    } else {
      this.logger.log(
        `Product ${product.id} analysis cache miss: no previous analysis`,
      );
    }

    this.logger.log(`Product ${product.id} OpenAI analysis started`);

    const taxonomyConcepts = await this.getTaxonomyConcepts();
    const analysisInput = this.buildAnalysisInput(
      normalizedPayload,
      taxonomyConcepts,
    );
    const openAiAnalysis = await this.generateAnalysis(analysisInput);
    const normalizedOpenAiAnalysis = this.normalizeAnalysis(
      openAiAnalysis,
      taxonomyConcepts,
    );
    const normalizedAnalysis = this.mergeIngredientIntelligence(
      normalizedOpenAiAnalysis,
      ingredientIntelligence,
    );

    const analysis = this.analysisRepo.create({
      product,
      status: 'completed',
      analysisSource: ANALYSIS_SOURCE,
      analysisHash,
      scores: normalizedAnalysis.scores,
      warnings: normalizedAnalysis.warnings,
      matchedConcepts: normalizedAnalysis.matchedConcepts,
      confidence: normalizedAnalysis.confidence,
      ingredients: normalizedAnalysis.ingredients,
      rawAnalysis: {
        ...normalizedAnalysis,
        openai: normalizedOpenAiAnalysis,
        ingredientIntelligence,
        analysisSource: ANALYSIS_SOURCE,
        model:
          process.env.OPENAI_PRODUCT_ANALYSIS_MODEL ?? DEFAULT_OPENAI_MODEL,
      },
    });
    const explanation = this.generateExplanation(
      product,
      analysis,
      ingredientIntelligence,
    );

    analysis.rawAnalysis = {
      ...(analysis.rawAnalysis || {}),
      explanation,
    };

    const savedAnalysis = await this.analysisRepo.save(analysis);

    this.logger.log(
      `Product ${product.id} OpenAI analysis saved with hash ${this.shortHash(
        analysisHash,
      )}`,
    );

    return { cached: false, analysis: savedAnalysis, explanation };
  }

  private getOpenAiClient() {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new ServiceUnavailableException('OPENAI_API_KEY is not configured');
    }

    return new OpenAI({ apiKey });
  }

  private async getTaxonomyConcepts(): Promise<TaxonomyConcept[]> {
    const tags = await this.taxonomyTagRepo.find({
      order: { normalizedKey: 'ASC' },
      take: MAX_TAXONOMY_CONCEPTS,
    });

    return tags
      .filter((tag) => Boolean(tag.normalizedKey))
      .map((tag) => ({
        normalizedKey: tag.normalizedKey as string,
        name: tag.name,
        domain: tag.domain,
        kind: tag.kind,
        synonyms: tag.synonyms,
      }));
  }

  private buildAnalysisInput(
    normalizedPayload: Record<string, unknown>,
    taxonomyConcepts: TaxonomyConcept[],
  ) {
    return {
      product: normalizedPayload,
      allowedTaxonomyConcepts: taxonomyConcepts,
      outputContract: {
        warnings: 'normalized taxonomy concept keys only',
        matchedConcepts: 'normalized taxonomy concept keys only',
        scores: {
          hydrationScore: 'number from 0 to 100',
          acneSafetyScore: 'number from 0 to 100',
          sensitiveSafetyScore: 'number from 0 to 100',
        },
        confidence: 'number from 0 to 1',
        ingredients: 'normalized ingredient names detected from INCI text',
      },
    };
  }

  private buildNormalizedAnalysisPayload(
    product: Product,
    detectedIngredients: string[],
  ) {
    const payload = this.removeEmptyValues({
      name: this.normalizePayloadText(product.name),
      brand: this.normalizePayloadText(product.brand),
      description: this.normalizePayloadText(product.description),
      categoryName: this.normalizePayloadText(product.categoryName),
      categoryPath: this.normalizePayloadText(product.categoryPath),
      mainCategory: this.normalizePayloadText(product.mainCategory),
      ingredients: this.normalizePayloadStrings(detectedIngredients),
      tags: this.normalizePayloadArray(
        (product.tags || []).map((tag) => ({
          name: this.normalizePayloadText(tag.name),
          normalizedKey: this.normalizePayloadText(tag.normalizedKey),
          sourceCategory: this.normalizePayloadText(tag.sourceCategory),
          domain: this.normalizePayloadText(tag.domain),
          kind: this.normalizePayloadText(tag.kind),
        })),
      ),
      specs: this.normalizePayloadArray(
        (product.specs || []).map((spec) => ({
          name: this.normalizePayloadText(spec.name),
          normalizedKey: this.normalizePayloadText(spec.normalizedKey),
          value: this.normalizePayloadText(spec.value),
        })),
      ),
    });

    return (payload || {}) as Record<string, unknown>;
  }

  private hashAnalysisPayload(payload: Record<string, unknown>) {
    return createHash('sha256')
      .update(this.stableJsonStringify(payload))
      .digest('hex');
  }

  private async findLatestAnalysis(productId: number) {
    return this.analysisRepo.findOne({
      where: { product: { id: productId } },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
  }

  private isCacheableAnalysis(analysis: ProductAnalysis) {
    return (
      analysis.status === 'completed' &&
      Boolean(analysis.analysisHash) &&
      this.isAnalysisScores(analysis.scores) &&
      this.isStringArray(analysis.warnings) &&
      this.isStringArray(analysis.matchedConcepts) &&
      this.isStringArray(analysis.ingredients) &&
      this.hasIngredientIntelligence(analysis.rawAnalysis) &&
      typeof analysis.confidence === 'number' &&
      Number.isFinite(analysis.confidence)
    );
  }

  private isAnalysisScores(value: unknown): value is ProductAnalysisScores {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    const scores = value as Record<string, unknown>;

    return PRODUCT_ANALYSIS_SCORE_KEYS.every(
      (key) => typeof scores[key] === 'number' && Number.isFinite(scores[key]),
    );
  }

  private isStringArray(value: unknown): value is string[] {
    return (
      Array.isArray(value) && value.every((item) => typeof item === 'string')
    );
  }

  private hasIngredientIntelligence(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    const ingredientIntelligence = (value as Record<string, unknown>)
      .ingredientIntelligence;

    if (
      !ingredientIntelligence ||
      typeof ingredientIntelligence !== 'object' ||
      Array.isArray(ingredientIntelligence)
    ) {
      return false;
    }

    const record = ingredientIntelligence as Record<string, unknown>;

    return (
      this.isStringArray(record.detectedIngredients) &&
      this.isStringArray(record.knownIngredients) &&
      this.isStringArray(record.unknownIngredients) &&
      this.isStringArray(record.benefits) &&
      this.isStringArray(record.risks) &&
      this.isStringArray(record.warnings) &&
      this.isIngredientIntelligenceScores(record.scores)
    );
  }

  private isIngredientIntelligenceScores(
    value: unknown,
  ): value is IngredientIntelligenceResult['scores'] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    const scores = value as Record<string, unknown>;

    return [
      'hydrationBoost',
      'barrierSupportBoost',
      'irritationPenalty',
      'acneRiskPenalty',
    ].every(
      (key) => typeof scores[key] === 'number' && Number.isFinite(scores[key]),
    );
  }

  private extractIngredients(product: Product) {
    const ingredients = new Set<string>();

    for (const spec of product.specs || []) {
      const key = `${spec.name} ${spec.normalizedKey ?? ''}`;
      if (/ingredient|inci/i.test(key)) {
        this.addIngredientText(ingredients, spec.value);
      }
    }

    this.collectRawIngredientValues(product.rawData, ingredients);

    return Array.from(ingredients);
  }

  private normalizePayloadText(value: unknown) {
    if (typeof value !== 'string') return undefined;

    const normalized = value.trim().toLowerCase();
    return normalized || undefined;
  }

  private normalizePayloadStrings(values: string[]) {
    const normalized = Array.from(
      new Set(
        values
          .map((value) => this.normalizePayloadText(value))
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort();

    return normalized.length ? normalized : undefined;
  }

  private normalizePayloadArray(values: unknown[]) {
    const normalized: unknown[] = [];

    for (const value of values) {
      const cleaned = this.removeEmptyValues(value);
      if (cleaned !== undefined) normalized.push(cleaned);
    }

    normalized.sort((a, b) =>
      this.stableJsonStringify(a).localeCompare(this.stableJsonStringify(b)),
    );

    return normalized.length ? normalized : undefined;
  }

  private removeEmptyValues(value: unknown): unknown {
    if (value === null || value === undefined) return undefined;

    if (typeof value === 'string') {
      const normalized = value.trim();
      return normalized || undefined;
    }

    if (Array.isArray(value)) {
      const normalized = value
        .map((item) => this.removeEmptyValues(item))
        .filter((item) => item !== undefined);

      return normalized.length ? normalized : undefined;
    }

    if (typeof value !== 'object') return value;

    const result: Record<string, unknown> = {};

    for (const key of Object.keys(value).sort()) {
      const normalized = this.removeEmptyValues(
        (value as Record<string, unknown>)[key],
      );
      if (normalized !== undefined) result[key] = normalized;
    }

    return Object.keys(result).length ? result : undefined;
  }

  private stableJsonStringify(value: unknown) {
    return JSON.stringify(this.sortJsonValue(value));
  }

  private sortJsonValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sortJsonValue(item));
    }

    if (!value || typeof value !== 'object') return value;

    const result: Record<string, unknown> = {};

    for (const key of Object.keys(value).sort()) {
      result[key] = this.sortJsonValue((value as Record<string, unknown>)[key]);
    }

    return result;
  }

  private shortHash(hash: string) {
    return hash.slice(0, 12);
  }

  private collectRawIngredientValues(
    value: unknown,
    ingredients: Set<string>,
    keyPath = '',
  ) {
    if (value === null || value === undefined) return;

    if (typeof value === 'string') {
      if (/ingredient|inci/i.test(keyPath)) {
        this.addIngredientText(ingredients, value);
      }
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        this.collectRawIngredientValues(item, ingredients, keyPath);
      }
      return;
    }

    if (typeof value !== 'object') return;

    for (const [key, nestedValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      const nestedPath = keyPath ? `${keyPath}.${key}` : key;
      this.collectRawIngredientValues(nestedValue, ingredients, nestedPath);
    }
  }

  private addIngredientText(ingredients: Set<string>, value: unknown) {
    if (typeof value !== 'string') return;

    const normalized = value.trim();
    if (normalized) ingredients.add(normalized);
  }

  private generateExplanation(
    product: Product,
    productAnalysis: ProductAnalysis,
    ingredientIntelligence: IngredientIntelligenceResult,
  ): ProductExplanation {
    return this.explainabilityService.generateProductExplanation({
      productTags: product.tags,
      productAnalysis,
      ingredientIntelligence,
    });
  }

  private mergeIngredientIntelligence(
    analysis: OpenAiProductAnalysis,
    ingredientIntelligence: IngredientIntelligenceResult,
  ): OpenAiProductAnalysis {
    const ingredientScores = ingredientIntelligence.scores;

    return {
      warnings: this.uniqueSorted(
        [...analysis.warnings, ...ingredientIntelligence.warnings].map(
          (warning) => this.normalizeKey(warning),
        ),
      ),
      matchedConcepts: this.uniqueSorted(
        [
          ...analysis.matchedConcepts,
          ...ingredientIntelligence.benefits,
          ...ingredientIntelligence.risks,
        ].map((concept) => this.normalizeKey(concept)),
      ),
      scores: {
        hydrationScore: this.normalizeNumber(
          analysis.scores.hydrationScore +
            ingredientScores.hydrationBoost +
            ingredientScores.barrierSupportBoost,
          0,
          100,
        ),
        acneSafetyScore: this.normalizeNumber(
          analysis.scores.acneSafetyScore - ingredientScores.acneRiskPenalty,
          0,
          100,
        ),
        sensitiveSafetyScore: this.normalizeNumber(
          analysis.scores.sensitiveSafetyScore -
            ingredientScores.irritationPenalty,
          0,
          100,
        ),
      },
      confidence: analysis.confidence,
      ingredients: this.uniqueSorted(
        [...analysis.ingredients, ...ingredientIntelligence.detectedIngredients]
          .map((ingredient) => this.normalizePayloadText(ingredient))
          .filter((ingredient): ingredient is string => Boolean(ingredient)),
      ),
    };
  }

  private async generateAnalysis(input: Record<string, unknown>) {
    const client = this.getOpenAiClient();

    try {
      const response = await client.responses.create({
        model:
          process.env.OPENAI_PRODUCT_ANALYSIS_MODEL ?? DEFAULT_OPENAI_MODEL,
        instructions: this.buildPrompt(),
        input: JSON.stringify(input),
        temperature: 0,
        max_output_tokens: 1200,
        text: {
          format: PRODUCT_ANALYSIS_RESPONSE_FORMAT,
        },
      });

      if (response.error) {
        this.logger.error(
          `OpenAI product analysis failed: ${response.error.message}`,
        );
        throw new BadGatewayException(
          'OpenAI product analysis returned an error',
        );
      }

      if (!response.output_text) {
        throw new BadGatewayException(
          'OpenAI product analysis returned no JSON output',
        );
      }

      return this.parseAnalysisResponse(response.output_text);
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      this.logger.error(
        'OpenAI product analysis request failed',
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException(
        'OpenAI product analysis is unavailable',
      );
    }
  }

  private buildPrompt() {
    return [
      'You are HARMONIQ product analysis infrastructure for Beauty and INCI intelligence.',
      'Analyze only the supplied product metadata and ingredient/INCI text.',
      'Return strict JSON only in the provided schema. Do not include Markdown, prose, or comments.',
      'Use normalized snake_case keys for warnings and matchedConcepts.',
      'Prefer allowedTaxonomyConcepts from the input. Use only their normalizedKey values when a clear concept applies.',
      'Do not invent random concepts, user facts, diagnoses, catalog rankings, or product recommendations.',
      'The backend owns deterministic catalog scoring, taxonomy matching, and recommendations.',
      'Scores must describe this product analysis only: hydrationScore, acneSafetyScore, and sensitiveSafetyScore are numbers from 0 to 100.',
      'confidence is a number from 0 to 1 based on ingredient and metadata evidence quality.',
      'ingredients must list normalized ingredient names detected from the supplied INCI or ingredient text. If none are available, return an empty array.',
      'When evidence is missing or uncertain, return empty arrays, 0 scores, and lower confidence instead of guessing.',
    ].join('\n');
  }

  private parseAnalysisResponse(outputText: string) {
    try {
      return JSON.parse(outputText) as OpenAiProductAnalysis;
    } catch (error) {
      this.logger.error(
        'OpenAI product analysis returned invalid JSON',
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadGatewayException(
        'OpenAI product analysis returned invalid JSON',
      );
    }
  }

  private normalizeAnalysis(
    analysis: OpenAiProductAnalysis,
    taxonomyConcepts: TaxonomyConcept[],
  ): OpenAiProductAnalysis {
    const allowedConcepts = new Set(
      taxonomyConcepts.map((concept) => concept.normalizedKey),
    );

    return {
      warnings: this.normalizeConcepts(analysis.warnings, allowedConcepts),
      matchedConcepts: this.normalizeConcepts(
        analysis.matchedConcepts,
        allowedConcepts,
      ),
      scores: {
        hydrationScore: this.normalizeNumber(
          analysis.scores?.hydrationScore,
          0,
          100,
        ),
        acneSafetyScore: this.normalizeNumber(
          analysis.scores?.acneSafetyScore,
          0,
          100,
        ),
        sensitiveSafetyScore: this.normalizeNumber(
          analysis.scores?.sensitiveSafetyScore,
          0,
          100,
        ),
      },
      confidence: this.normalizeNumber(analysis.confidence, 0, 1),
      ingredients: this.normalizeStringArray(analysis.ingredients),
    };
  }

  private normalizeConcepts(values: unknown, allowedConcepts: Set<string>) {
    if (!allowedConcepts.size) return [];

    return this.normalizeStringArray(values)
      .map((value) => this.normalizeKey(value))
      .filter((value) => allowedConcepts.has(value));
  }

  private normalizeStringArray(values: unknown) {
    if (!Array.isArray(values)) return [];

    return Array.from(
      new Set(
        values
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    );
  }

  private normalizeKey(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private normalizeNumber(value: unknown, min: number, max: number) {
    const numeric = typeof value === 'number' ? value : Number(value);

    if (!Number.isFinite(numeric)) return min;

    return Math.min(max, Math.max(min, numeric));
  }

  private uniqueSorted(values: string[]) {
    return Array.from(new Set(values.filter(Boolean))).sort();
  }
}
