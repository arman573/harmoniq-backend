# AI Arman - Recommendation Contract

Status: Locked foundation draft
Date: 2026-08-04

## Ranking priority

AI Arman's before-purchase recommendation engine uses this order:

1. Product designation and INCI suitability together
2. Category
3. Tags
4. Hello Retail personalization after quality approval
5. Live Vendre facts before presentation

Product designation and INCI are joint priority one. Neither may be replaced by category popularity, tags or behavioral personalization.

## Product designation

Product designation is a normalized functional identity, not merely the marketing title.

Examples:

- moisturizing shampoo;
- silver shampoo;
- leave-in conditioner;
- heat protection;
- protein mask;
- oil cleanser;
- retinol serum;
- waterproof mascara.

The designation analysis must determine:

- product type;
- routine step;
- intended use;
- primary problem addressed;
- whether the product is relevant to the customer's request.

## INCI suitability

Ingredient Intelligence must retain the original INCI and return evidence, confidence and engine version.

The suitability analysis may include:

- cleansing system;
- humectants;
- emollients and oils;
- proteins and strengthening ingredient families;
- silicones;
- active ingredients;
- fragrance and declared allergens;
- possible irritation signals;
- ingredient conflicts;
- concentration indicators when responsibly inferable;
- evidence and confidence.

The engine must distinguish between:

- verified ingredient presence;
- derived ingredient-family classification;
- cautious formulation inference;
- unknown or insufficient evidence.

It must never claim exact concentration or clinical effect without evidence.

## Initial scoring model

```text
designationScore: 35 percent
inciSuitabilityScore: 35 percent
categoryScore: 20 percent
tagScore: 10 percent
```

All component scores use a 0-100 scale.

```text
finalQualityScore =
  designationScore * 0.35 +
  inciSuitabilityScore * 0.35 +
  categoryScore * 0.20 +
  tagScore * 0.10
```

## Mandatory quality gates

A product is ineligible when either gate fails:

```text
designationScore < 60
inciSuitabilityScore < 55
```

A hard blocker also makes the product ineligible regardless of total score.

Examples of hard blockers:

- wrong product type;
- explicit customer exclusion is violated;
- a verified allergen conflict;
- the product is inactive or cannot be sold;
- required product evidence is missing for a high-risk claim.

## Quality tiers

```text
Tier A: 85-100
Tier B: 70-84.99
Tier C: 60-69.99
Not recommended: below 60 or failed gate
```

Hello Retail may reorder products within the same quality tier. It must not promote a lower-tier product above a higher-tier product solely because of clicks, popularity, purchase history, views or cart activity.

A bounded personalization adjustment may be used only as a tie-breaker inside a tier.

## Candidate flow

1. Interpret the customer's stated need into a structured need profile.
2. Retrieve candidates by normalized product designation and relevant product types.
3. Evaluate INCI suitability for every candidate.
4. Apply hard blockers and mandatory gates.
5. Score category relevance.
6. Score allowed tags.
7. Assign quality tier.
8. Apply bounded Hello Retail personalization within the tier.
9. fetch current price, stock, status and URL from an authoritative source.
10. Present only products with adequate evidence.

## Need profile example

Customer statement:

```text
I need a shampoo for colored, dry hair that becomes frizzy easily.
```

Structured interpretation:

```json
{
  "requestedProductTypes": ["shampoo"],
  "primaryNeeds": ["moisture"],
  "secondaryNeeds": ["color_preservation", "frizz_control"],
  "avoidSignals": ["overly_strong_cleansing"],
  "desiredIngredientSignals": [
    "mild_cleansers",
    "humectants",
    "emollients",
    "conditioning_agents",
    "frizz_control_film_formers"
  ]
}
```

## Result selection

AI Arman should normally return up to three distinct roles:

1. Best overall match
2. Best value among adequately matched products
3. Best option for a meaningful special preference

A special preference can be:

- fragrance-free;
- silicone-free;
- protein-free;
- extra gentle;
- vegan;
- premium;
- budget;
- extra color-preserving.

The engine must return fewer than three products when fewer than three products meet the quality standard. It must not fill empty slots with weak matches.

## Required explanation per product

Every recommendation must include structured evidence for:

- why it matches;
- product-designation match;
- important INCI signals;
- needs addressed;
- limitations or trade-offs;
- usage guidance from verified product facts;
- current price and stock source;
- product URL;
- confidence;
- data timestamp.

## Live-fact rule

Price, stock, sale status, product availability and product URL must come from Vendre or another explicitly authoritative, timestamped source.

The language model must never guess or reuse stale conversational values as current facts.
