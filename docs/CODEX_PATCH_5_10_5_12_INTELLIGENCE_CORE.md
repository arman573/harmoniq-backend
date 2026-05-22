# HARMONIQ Codex Task: PATCH 5.10, 5.11, 5.12

## Goal
Complete the Beauty Intelligence Core before moving into the V1 live customer experience layer.

This should be implemented cost-effectively with minimal architecture churn.

Do not rewrite the recommendation engine. Extend the existing taxonomy-first, backend-owned logic.

Core principle:

> AI interprets. Backend decides. Backend explains. Backend estimates confidence.

OpenAI may interpret/extract structured signals, but backend must own:
- scoring
- blockers
- risk logic
- recommendation decisions
- explainability
- confidence
- evidence normalization

---

## Current state assumed
The backend already has:
- NestJS
- PostgreSQL
- Auth/JWT
- Tickets/messages
- Customers
- Products
- Taxonomy
- ProductAnalysis
- Recommendations
- Ingredient Intelligence v1
- Explainability Engine
- Recommendation Engine v5
- Multi-domain support: skin, hair, fragrance, nails, makeup, body, general
- Hair Intelligence v1
- Fragrance Intelligence v1
- Confidence & Evidence Engine
- Unified Beauty Profile
- Profile-aware recommendations

Latest known verification before this task:
- `npm run build` passes
- `npm test -- --runInBand` passes
- 6 test suites, 77 tests passed

If the checked-out repo does not match this state, stop and report the mismatch instead of inventing missing modules.

---

# PATCH 5.10 — Nails Intelligence v1

## Objective
Add deterministic nail-domain intelligence to taxonomy, product analysis, recommendation scoring, blockers, explanations and unified profile.

## Add / confirm domain
Use existing domain model if present:

```ts
'nails'
```

Do not introduce a new domain abstraction if domains already exist.

## Add normalized taxonomy keys

### Customer/Profile facts
```ts
brittle_nails
weak_nails
peeling_nails
dry_cuticles
sensitive_nails
gel_damage
nail_growth_focus
```

### Product/product analysis positive signals
```ts
strengthening
hydrating_cuticle
keratin_support
nail_repair
ridge_smoothing
fast_drying
salon_quality
nail_growth_support
```

### Risk signals
```ts
drying_formula_risk
formaldehyde_risk
nail_irritation_risk
```

## Ingredient Intelligence mappings
Add deterministic mappings where the existing ingredient intelligence lives.

Recommended mappings:

```ts
keratin -> keratin_support, strengthening
biotin -> nail_growth_support
vitamin_e -> hydrating_cuticle
jojoba_oil -> hydrating_cuticle
panthenol -> nail_repair
formaldehyde -> formaldehyde_risk
formalin -> formaldehyde_risk
toluene -> nail_irritation_risk
acetone -> drying_formula_risk
alcohol_denat -> drying_formula_risk
```

Keep confidence deterministic and conservative.

Suggested confidence:
- direct ingredient risk: 0.9
- direct benefit: 0.75 - 0.85
- inferred/general signal: 0.6 - 0.7

## Recommendation scoring
Add domain-aware scoring items for nails.

Positive examples:
- `brittle_nails` + `strengthening`
- `weak_nails` + `keratin_support`
- `dry_cuticles` + `hydrating_cuticle`
- `gel_damage` + `nail_repair`
- `nail_growth_focus` + `nail_growth_support`

Risk/penalty examples:
- `brittle_nails` + `drying_formula_risk`
- `sensitive_nails` + `nail_irritation_risk`

## Hard blockers
Add blockers:

```ts
sensitive_nails + formaldehyde_risk
brittle_nails + drying_formula_risk
sensitive_nails + nail_irritation_risk
```

Each blocker must include:
- domain: `nails`
- customer signal
- product/analysis signal
- explanation/reason
- evidence source

## Explainability
Nail recommendations should produce reasons/warnings like:

```ts
"Supports weak or brittle nails with strengthening signals."
"Contains cuticle-hydrating signals that may help dry cuticles."
"Blocked because the customer has sensitive nails and the product has formaldehyde risk."
"Warning: may be drying for already brittle nails."
```

## Unified Beauty Profile
Include nails section if the profile builder already supports domain sections.

Suggested shape should follow existing domain conventions, not a new format.

Minimum signals:
- concerns
- preferences/goals
- sensitivities
- confidence
- evidence

---

# PATCH 5.11 — Makeup Intelligence v1

## Objective
Add deterministic makeup-domain intelligence to taxonomy, product analysis, recommendation scoring, blockers, explanations and unified profile.

## Add / confirm domain
Use existing domain model if present:

```ts
'makeup'
```

## Add normalized taxonomy keys

### Customer/Profile facts
```ts
sensitive_eyes
redness_prone
fragrance_sensitive
prefers_natural_finish
prefers_full_coverage
prefers_matte_finish
prefers_dewy_finish
```

Reuse existing keys where already present:
```ts
acne_prone
oily_skin
dry_skin
sensitive_skin
```

Do not duplicate existing skin keys under makeup.

### Product/product analysis positive signals
```ts
non_comedogenic
hydrating_makeup
matte_finish
dewy_finish
long_wear
sensitive_skin_friendly
full_coverage
natural_finish
redness_support
smoothing
```

### Risk signals
```ts
pore_clogging_risk
oxidation_risk
irritation_risk
fragrance_risk
eye_irritation_risk
```

## Ingredient Intelligence mappings
Add deterministic mappings where the existing ingredient intelligence lives.

Recommended mappings:

```ts
fragrance -> fragrance_risk
parfum -> fragrance_risk
limonene -> fragrance_risk
linalool -> fragrance_risk
coconut_oil -> pore_clogging_risk
isopropyl_myristate -> pore_clogging_risk
lanolin -> pore_clogging_risk
hyaluronic_acid -> hydrating_makeup
niacinamide -> redness_support
silicone / dimethicone -> smoothing
mica -> cosmetic_finish_signal
iron_oxides -> cosmetic_colorant_signal
```

Keep cosmetic finish/colorant signals low-risk unless the existing system already treats them differently.

## Recommendation scoring
Positive examples:
- `dry_skin` + `hydrating_makeup`
- `oily_skin` + `matte_finish`
- `redness_prone` + `redness_support`
- `prefers_natural_finish` + `natural_finish`
- `prefers_full_coverage` + `full_coverage`
- `sensitive_skin` + `sensitive_skin_friendly`

Risk/penalty examples:
- `acne_prone` + `pore_clogging_risk`
- `fragrance_sensitive` + `fragrance_risk`
- `sensitive_eyes` + `eye_irritation_risk`

## Hard blockers
Add blockers:

```ts
acne_prone + pore_clogging_risk
fragrance_sensitive + fragrance_risk
sensitive_eyes + eye_irritation_risk
sensitive_skin + irritation_risk
```

Each blocker must include:
- domain: `makeup`
- customer signal
- product/analysis signal
- explanation/reason
- evidence source

## Explainability
Makeup recommendations should produce reasons/warnings like:

```ts
"Matches the customer's preference for a natural finish."
"Hydrating makeup signals align with the customer's dry skin profile."
"Blocked because the customer is acne-prone and the product has pore-clogging risk."
"Warning: fragrance signals may not fit a fragrance-sensitive customer."
```

## Unified Beauty Profile
Include makeup section if the profile builder already supports domain sections.

Minimum signals:
- concerns
- finish preferences
- coverage preferences
- sensitivities
- confidence
- evidence

---

# PATCH 5.12 — Intelligence Core Stabilization

## Objective
Stabilize the core before V1 live advisor/support work. Do not add another big feature here.

## 1. Taxonomy cleanup
Audit taxonomy keys for:
- duplicate meaning
- inconsistent naming
- missing domain metadata
- aliases that should map to a normalized key

Be careful with these distinctions:

```ts
fragrance_free        // product/customer preference or product claim
fragrance_sensitive   // customer sensitivity
fragrance_risk        // product/ingredient risk
fragrance_allergen_risk // stronger allergen-oriented risk
```

Do not collapse these into one key.

## 2. Evidence normalization
Make sure evidence items follow one consistent shape across skin/hair/fragrance/nails/makeup.

Recommended shape, adapt to existing code style:

```ts
{
  source: 'customer_fact' | 'customer_profile' | 'product_tag' | 'product_analysis' | 'ingredient_intelligence' | 'fragrance_profile' | 'rule' | 'manual',
  key: string,
  domain: 'skin' | 'hair' | 'fragrance' | 'nails' | 'makeup' | 'body' | 'general',
  confidence: number,
  direction?: 'positive' | 'negative' | 'neutral',
  reason?: string
}
```

## 3. Confidence stabilization
Document and test how recommendation confidence is calculated.

Confidence should consider:
- amount of positive evidence
- amount of negative evidence
- missing evidence
- conflicts
- product analysis confidence
- customer profile confidence
- hard blockers

Hard blockers should generally cap or lower confidence in positive recommendation, not hide the blocker.

## 4. Explanation consistency
All recommendation explanations should follow consistent shape:

```ts
{
  summary: string,
  reasons: string[],
  warnings: string[],
  scoreImpact: unknown[],
  confidence: number,
  confidenceLevel: 'low' | 'medium' | 'high'
}
```

Adapt to existing code if shape differs, but keep one standard.

## 5. Domain consistency
Check that these domains all work with the same model:
- skin
- hair
- fragrance
- nails
- makeup

Each should support:
- scoring
- blockers
- evidence
- explanations
- confidence
- profile alignment
- domain metadata

---

# Tests required
Add/extend tests for:

## Nails
- brittle nails + strengthening product gives positive score
- sensitive nails + formaldehyde risk blocks
- brittle nails + drying formula risk blocks or strong warning
- nails evidence includes domain `nails`

## Makeup
- acne-prone + pore-clogging risk blocks
- fragrance-sensitive + fragrance risk blocks
- dry skin + hydrating makeup gives positive score
- natural finish preference aligns with natural finish product
- makeup evidence includes domain `makeup`

## Regression
- existing skin blockers still pass
- existing hair blockers still pass
- existing fragrance blockers still pass
- build passes
- all tests pass

Commands:

```bash
npm run build
npm test -- --runInBand
```

---

# Implementation guidance
Prefer small, local changes.

Do not:
- introduce a second recommendation engine
- move OpenAI into scoring decisions
- add heavy dependencies
- rewrite entities unless required
- change API response shapes unnecessarily

Do:
- extend existing maps/rules/constants
- reuse existing evidence/confidence helpers
- keep deterministic backend rules
- add tests close to the changed logic
- preserve current API compatibility

---

# Acceptance criteria
The task is complete when:

1. PATCH 5.10 Nails Intelligence v1 is implemented.
2. PATCH 5.11 Makeup Intelligence v1 is implemented.
3. PATCH 5.12 stabilization is implemented or documented in code/tests where appropriate.
4. `npm run build` passes.
5. `npm test -- --runInBand` passes.
6. Recommendation responses can include nails and makeup domain evidence, blockers, confidence and explanations.
7. No extra OpenAI calls are introduced for deterministic backend logic.

---

# Final note
If the repository checked out by Codex does not contain the modern modules described above, stop and report:

> Repo mismatch: expected products/recommendations/product-analysis/unified-profile modules are missing.

Then ask Arman to point Codex to the correct repo/branch before implementing code.
