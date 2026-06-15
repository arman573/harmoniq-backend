import { createHash } from 'node:crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ExplainabilityService,
  ProductExplanation,
} from '../explainability/explainability.service';
import {
  IngredientIntelligenceResult,
  IngredientsService,
} from '../ingredients/ingredients.service';
import { ProductAnalysis } from './product-analysis.entity';
import { Product } from './product.entity';

export type ProductAnalysisScores = {
  hydrationScore: number;
  acneSafetyScore: number;
  sensitiveSafetyScore: number;
};

const ANALYSIS_SOURCE = 'backend-ingredient-intelligence-v1';

@Injectable()
export class ProductAnalysisService {
  private readonly logger = new Logger(ProductAnalysisService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductAnalysis)
    private readonly analysisRepo: Repository<ProductAnalysis>,
    private readonly ingredientsService: IngredientsService,
    private readonly explainabilityService: ExplainabilityService,
  ) {}

  async analyzeProduct(productId: number) {
    const product = await this.productRepo.findOne({
      where: { id: productId },
      relations: { specs: true, tags: true, analyses: true },
    });

    if (!product) throw new NotFoundException(`Product ${productId} not found`);

    const extractedIngredients = this.extractIngredients(product);
    const ingredientIntelligence =
      this.ingredientsService.analyzeIngredients(extractedIngredients);
    const analysisHash = this.hashAnalysisPayload({
      productId: product.id,
      name: product.name,
      brand: product.brand,
      categoryName: product.categoryName,
      categoryPath: product.categoryPath,
      mainCategory: product.mainCategory,
      ingredients: ingredientIntelligence.detectedIngredients,
      tags: (product.tags || []).map((tag) => tag.normalizedKey || tag.name),
      specs: (product.specs || []).map((spec) => ({
        name: spec.name,
        normalizedKey: spec.normalizedKey,
        value: spec.value,
      })),
    });
    const latestAnalysis = await this.findLatestAnalysis(product.id);

    if (
      latestAnalysis?.analysisSource === ANALYSIS_SOURCE &&
      latestAnalysis.analysisHash === analysisHash
    ) {
      const explanation = this.generateExplanation(
        product,
        latestAnalysis,
        ingredientIntelligence,
      );
      return { cached: true, analysis: latestAnalysis, explanation };
    }

    const scores = this.buildScores(ingredientIntelligence);
    const warnings = ingredientIntelligence.warnings;
    const matchedConcepts = this.uniqueSorted([
      ...ingredientIntelligence.benefits,
      ...ingredientIntelligence.risks,
    ]);
    const confidence = this.estimateConfidence(ingredientIntelligence);

    const analysis = this.analysisRepo.create({
      product,
      status: 'completed',
      analysisSource: ANALYSIS_SOURCE,
      analysisHash,
      scores,
      warnings,
      matchedConcepts,
      confidence,
      ingredients: ingredientIntelligence.detectedIngredients,
      rawAnalysis: {
        ingredientIntelligence,
        analysisSource: ANALYSIS_SOURCE,
        explanationVersion: 'product-explainability-v1',
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
    this.logger.log(`Product ${product.id} analysis saved using ${ANALYSIS_SOURCE}`);

    return { cached: false, analysis: savedAnalysis, explanation };
  }

  private findLatestAnalysis(productId: number) {
    return this.analysisRepo.findOne({
      where: { product: { id: productId } },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
  }

  private extractIngredients(product: Product) {
    const ingredients = new Set<string>();

    for (const spec of product.specs || []) {
      const key = `${spec.name} ${spec.normalizedKey ?? ''}`;
      if (/ingredient|ingredients|inci|ingredienser/i.test(key)) {
        this.addIngredientText(ingredients, spec.value);
      }
    }

    this.collectRawIngredientValues(product.rawData, ingredients);
    return Array.from(ingredients);
  }

  private collectRawIngredientValues(
    value: unknown,
    ingredients: Set<string>,
    keyPath = '',
  ) {
    if (value === null || value === undefined) return;

    if (typeof value === 'string') {
      if (/ingredient|ingredients|inci|ingredienser/i.test(keyPath)) {
        this.addIngredientText(ingredients, value);
      }
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) this.collectRawIngredientValues(item, ingredients, keyPath);
      return;
    }

    if (typeof value !== 'object') return;

    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      const nestedPath = keyPath ? `${keyPath}.${key}` : key;
      this.collectRawIngredientValues(nestedValue, ingredients, nestedPath);
    }
  }

  private addIngredientText(ingredients: Set<string>, value: unknown) {
    if (typeof value !== 'string') return;
    const normalized = value.trim();
    if (normalized) ingredients.add(normalized);
  }

  private buildScores(
    ingredientIntelligence: IngredientIntelligenceResult,
  ): ProductAnalysisScores {
    const scores = ingredientIntelligence.scores;

    return {
      hydrationScore: this.normalizeNumber(
        scores.hydrationBoost + scores.barrierSupportBoost,
        0,
        100,
      ),
      acneSafetyScore: this.normalizeNumber(100 - scores.acneRiskPenalty, 0, 100),
      sensitiveSafetyScore: this.normalizeNumber(
        100 - scores.irritationPenalty,
        0,
        100,
      ),
    };
  }

  private estimateConfidence(ingredientIntelligence: IngredientIntelligenceResult) {
    const detected = ingredientIntelligence.detectedIngredients.length;
    if (!detected) return 0.2;

    const known = ingredientIntelligence.knownIngredients.length;
    return this.normalizeNumber(known / detected, 0.3, 1);
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

  private hashAnalysisPayload(payload: Record<string, unknown>) {
    return createHash('sha256')
      .update(JSON.stringify(this.sortJsonValue(payload)))
      .digest('hex');
  }

  private sortJsonValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.sortJsonValue(item));
    if (!value || typeof value !== 'object') return value;

    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      result[key] = this.sortJsonValue((value as Record<string, unknown>)[key]);
    }
    return result;
  }

  private normalizeNumber(value: number, min: number, max: number) {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
  }

  private uniqueSorted(values: string[]) {
    return Array.from(new Set(values.filter(Boolean))).sort();
  }
}
