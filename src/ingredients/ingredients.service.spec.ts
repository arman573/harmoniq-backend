import { Repository } from 'typeorm';
import { Ingredient } from './ingredient.entity';
import { IngredientsService } from './ingredients.service';

function createService() {
  return new IngredientsService({
    findOne: jest.fn(),
    create: jest.fn((ingredient: Ingredient) => ingredient),
    save: jest.fn(async (ingredient: Ingredient) => ingredient),
  } as unknown as Repository<Ingredient>);
}

describe('IngredientsService', () => {
  it('parses and normalizes ingredient lists deterministically', () => {
    const service = createService();

    expect(
      service.parseIngredientList([' Water,  Glycerin ', 'NIACINAMIDE']),
    ).toEqual(['glycerin', 'niacinamide', 'water']);
  });

  it('matches parfum as fragrance', () => {
    const service = createService();

    expect(service.matchIngredient('parfum')?.normalizedName).toBe('fragrance');
  });

  it('adds glycerin hydration boost', () => {
    const service = createService();

    const result = service.analyzeIngredients('water, glycerin');

    expect(result.knownIngredients).toContain('glycerin');
    expect(result.scores.hydrationBoost).toBe(20);
  });

  it('adds fragrance warning from parfum alias', () => {
    const service = createService();

    const result = service.analyzeIngredients('water, parfum');

    expect(result.warnings).toContain('contains_fragrance');
    expect(result.warnings).toContain('sensitive_skin_risk');
    expect(result.warnings).toContain('fragrance_allergen_risk');
    expect(result.warnings).toContain('migraine_trigger_risk');
  });

  it('adds alcohol denat warning', () => {
    const service = createService();

    const result = service.analyzeIngredients('water, alcohol denat.');

    expect(result.warnings).toContain('contains_drying_alcohol');
  });

  it('adds coconut oil comedogenic warning', () => {
    const service = createService();

    const result = service.analyzeIngredients('water, coconut oil');

    expect(result.warnings).toContain('comedogenic_risk');
    expect(result.benefits).toContain('moisturizing_hair');
    expect(result.scores.acneRiskPenalty).toBe(30);
  });

  it('detects sodium lauryl sulfate hair risks', () => {
    const service = createService();

    const result = service.analyzeIngredients('water, sodium lauryl sulfate');

    expect(result.knownIngredients).toContain('sodium lauryl sulfate');
    expect(result.risks).toEqual(
      expect.arrayContaining([
        'contains_sulfates',
        'color_stripping_risk',
        'scalp_irritation_risk',
      ]),
    );
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'contains_sulfates',
        'color_stripping_risk',
        'scalp_irritation_risk',
      ]),
    );
  });

  it('detects hydrolyzed keratin as protein-rich hair support', () => {
    const service = createService();

    const result = service.analyzeIngredients('water, hydrolyzed keratin');

    expect(result.knownIngredients).toContain('hydrolyzed keratin');
    expect(result.benefits).toEqual(
      expect.arrayContaining(['protein_rich', 'strengthening_hair']),
    );
  });

  it('detects limonene as citrus with fragrance allergen risk', () => {
    const service = createService();

    const result = service.analyzeIngredients('water, limonene');

    expect(result.knownIngredients).toContain('limonene');
    expect(result.benefits).toContain('citrus');
    expect(result.risks).toContain('fragrance_allergen_risk');
    expect(result.warnings).toContain('fragrance_allergen_risk');
  });

  it('detects vanillin as vanilla and gourmand', () => {
    const service = createService();

    const result = service.analyzeIngredients('water, vanillin');

    expect(result.knownIngredients).toContain('vanillin');
    expect(result.benefits).toEqual(
      expect.arrayContaining(['vanilla', 'gourmand']),
    );
  });

  it('preserves unknown ingredients', () => {
    const service = createService();

    const result = service.analyzeIngredients('water, mystery ferment');

    expect(result.unknownIngredients).toEqual(['mystery ferment']);
  });
});
