export type BeautyDomain =
  | 'skin'
  | 'hair'
  | 'fragrance'
  | 'nails'
  | 'makeup'
  | 'body'
  | 'general';

export const BEAUTY_DOMAINS: BeautyDomain[] = [
  'skin',
  'hair',
  'fragrance',
  'nails',
  'makeup',
  'body',
  'general',
];

const DOMAIN_KEY_MAP: Record<BeautyDomain, string[]> = {
  skin: [
    'dry_skin',
    'sensitive_skin',
    'acne_prone',
    'fragrance_free',
    'acne_safe',
    'contains_fragrance',
    'contains_drying_alcohol',
    'comedogenic_risk',
    'sensitive_skin_risk',
    'hydration',
    'barrier_support',
  ],
  hair: [
    'dry_hair',
    'oily_scalp',
    'curly_hair',
    'color_treated_hair',
    'damaged_hair',
    'frizzy_hair',
    'fine_hair',
    'thick_hair',
    'sensitive_scalp',
    'sulfate_free',
    'silicone_free',
    'protein_free',
    'protein_rich',
    'color_safe',
    'scalp_soothing',
    'curl_defining',
    'volumizing',
    'moisturizing_hair',
    'strengthening_hair',
    'contains_sulfates',
    'contains_heavy_silicones',
    'protein_overload_risk',
    'color_stripping_risk',
    'scalp_irritation_risk',
    'frizz_control',
  ],
  fragrance: [
    'floral',
    'woody',
    'citrus',
    'amber',
    'fresh',
    'aquatic',
    'aromatic',
    'gourmand',
    'spicy',
    'green',
    'musky',
    'powdery',
    'fruity',
    'leather',
    'oud',
    'vanilla',
    'longevity_high',
    'longevity_medium',
    'longevity_low',
    'projection_strong',
    'projection_moderate',
    'projection_soft',
    'sillage_strong',
    'sillage_soft',
    'office_safe',
    'date_night',
    'evening_wear',
    'daytime_wear',
    'summer_fragrance',
    'winter_fragrance',
    'signature_scent',
    'unisex',
    'feminine',
    'masculine',
    'migraine_trigger_risk',
    'fragrance_allergen_risk',
    'heavy_projection_risk',
    'cloying_sweetness_risk',
  ],
  nails: [
    'brittle_nails',
    'nail_strengthening',
    'ridge_filling',
    'acetone_free',
    'gel_safe',
  ],
  makeup: [],
  body: [],
  general: [],
};

export function normalizeDomainKey(value: unknown) {
  if (typeof value !== 'string') return null;

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || null;
}

export function getDomainForKey(value: unknown): BeautyDomain {
  const normalized = normalizeDomainKey(value);
  if (!normalized) return 'general';

  for (const domain of BEAUTY_DOMAINS) {
    if (domain === 'general') continue;
    if (DOMAIN_KEY_MAP[domain].includes(normalized)) return domain;
  }

  return 'general';
}

export function uniqueDomains(domains: BeautyDomain[]) {
  return Array.from(new Set(domains)).sort((a, b) => {
    const aIndex = BEAUTY_DOMAINS.indexOf(a);
    const bIndex = BEAUTY_DOMAINS.indexOf(b);

    return aIndex - bIndex;
  });
}
