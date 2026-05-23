import {
  BEAUTY_DOMAINS,
  BeautyDomain,
  getDomainForKey,
  normalizeDomainKey,
  uniqueDomains,
} from '../beauty-domain';
import { CustomerFact } from './customer-fact.entity';
import type { ConfidenceLevel } from './recommendation-evidence';

export type BeautyProfileSignal = {
  key: string;
  type: string;
  label: string;
  source: string;
  confidence: number;
  domain: BeautyDomain;
  evidenceCount: number;
  lastSeenAt?: string | Date;
};

export type DomainBeautyProfile = {
  domain: BeautyDomain;
  signals: BeautyProfileSignal[];
  concerns: BeautyProfileSignal[];
  preferences: BeautyProfileSignal[];
  sensitivities: BeautyProfileSignal[];
  goals: BeautyProfileSignal[];
  confidence: number;
  confidenceLevel: ConfidenceLevel;
};

export type UnifiedBeautyProfile = {
  customerId: number;
  domains: Record<BeautyDomain, DomainBeautyProfile>;
  preferences: BeautyProfileSignal[];
  sensitivities: BeautyProfileSignal[];
  concerns: BeautyProfileSignal[];
  goals: BeautyProfileSignal[];
  evidenceSummary: {
    totalFacts: number;
    domainsDetected: BeautyDomain[];
    confidence: number;
    confidenceLevel: ConfidenceLevel;
    missingDomains: BeautyDomain[];
  };
};

export type BeautyProfileSummary = {
  domainsDetected: BeautyDomain[];
  topConcerns: string[];
  topPreferences: string[];
  topSensitivities: string[];
  confidence: number;
  confidenceLevel: ConfidenceLevel;
};

type SignalCategories = {
  concerns: boolean;
  preferences: boolean;
  sensitivities: boolean;
  goals: boolean;
};

const SIGNAL_LABELS: Record<string, string> = {
  dry_skin: 'Dry skin',
  sensitive_skin: 'Sensitive skin',
  acne_prone: 'Acne prone',
  dry_hair: 'Dry hair',
  curly_hair: 'Curly hair',
  color_treated_hair: 'Color-treated hair',
  floral: 'Floral',
  woody: 'Woody',
  migraine_trigger_risk: 'Migraine trigger risk',
};

const INFERRED_CATEGORIES: Record<string, Partial<SignalCategories>> = {
  sensitive_skin: { concerns: true, sensitivities: true },
  sensitive_scalp: { concerns: true, sensitivities: true },
  fragrance_free: { preferences: true, sensitivities: true },
  migraine_trigger_risk: { sensitivities: true },
  fragrance_allergen_risk: { sensitivities: true },
  sulfate_free: { preferences: true },
  silicone_free: { preferences: true },
};

export function buildUnifiedBeautyProfile(
  customerId: number,
  facts: CustomerFact[],
): UnifiedBeautyProfile {
  const mergedSignals = mergeFacts(facts);
  const domains = createEmptyDomainProfiles();

  for (const { signal, categories } of mergedSignals.values()) {
    const domainProfile = domains[signal.domain];

    domainProfile.signals.push(signal);
    if (categories.concerns) domainProfile.concerns.push(signal);
    if (categories.preferences) domainProfile.preferences.push(signal);
    if (categories.sensitivities) domainProfile.sensitivities.push(signal);
    if (categories.goals) domainProfile.goals.push(signal);
  }

  for (const domain of BEAUTY_DOMAINS) {
    sortSignals(domains[domain].signals);
    sortSignals(domains[domain].concerns);
    sortSignals(domains[domain].preferences);
    sortSignals(domains[domain].sensitivities);
    sortSignals(domains[domain].goals);

    domains[domain].confidence = calculateDomainConfidence(
      domains[domain].signals,
    );
    domains[domain].confidenceLevel = getConfidenceLevel(
      domains[domain].confidence,
    );
  }

  const preferences = collectDomainSignals(domains, 'preferences');
  const sensitivities = collectDomainSignals(domains, 'sensitivities');
  const concerns = collectDomainSignals(domains, 'concerns');
  const goals = collectDomainSignals(domains, 'goals');
  const domainsDetected = uniqueDomains(
    BEAUTY_DOMAINS.filter((domain) => domains[domain].signals.length),
  );
  const confidence = calculateOverallConfidence(domains, facts.length);

  return {
    customerId,
    domains,
    preferences,
    sensitivities,
    concerns,
    goals,
    evidenceSummary: {
      totalFacts: facts.length,
      domainsDetected,
      confidence,
      confidenceLevel: getConfidenceLevel(confidence),
      missingDomains: BEAUTY_DOMAINS.filter(
        (domain) => !domainsDetected.includes(domain),
      ),
    },
  };
}

export function buildBeautyProfileSummary(
  profile: UnifiedBeautyProfile,
): BeautyProfileSummary {
  return {
    domainsDetected: profile.evidenceSummary.domainsDetected,
    topConcerns: profile.concerns.slice(0, 5).map((signal) => signal.key),
    topPreferences: profile.preferences.slice(0, 5).map((signal) => signal.key),
    topSensitivities: profile.sensitivities
      .slice(0, 5)
      .map((signal) => signal.key),
    confidence: profile.evidenceSummary.confidence,
    confidenceLevel: profile.evidenceSummary.confidenceLevel,
  };
}

function mergeFacts(facts: CustomerFact[]) {
  const merged = new Map<
    string,
    { signal: BeautyProfileSignal; categories: SignalCategories }
  >();

  for (const fact of facts) {
    const key = normalizeDomainKey(fact.value);
    if (!key) continue;

    const existing = merged.get(key);
    const createdAt = getFactCreatedAt(fact);
    const confidence = normalizeConfidence(fact.confidence);
    const categories = getSignalCategories(fact.type, key);

    if (!existing) {
      merged.set(key, {
        signal: {
          key,
          type: fact.type,
          label: getSignalLabel(key),
          source: fact.source ?? 'unknown',
          confidence,
          domain: getDomainForKey(key),
          evidenceCount: 1,
          lastSeenAt: createdAt,
        },
        categories,
      });
      continue;
    }

    existing.signal.evidenceCount += 1;
    existing.signal.confidence = Math.max(
      existing.signal.confidence,
      confidence,
    );
    existing.signal.lastSeenAt = getNewestDate(
      existing.signal.lastSeenAt,
      createdAt,
    );
    existing.categories = mergeCategories(existing.categories, categories);
  }

  return merged;
}

function createEmptyDomainProfiles() {
  return BEAUTY_DOMAINS.reduce(
    (acc, domain) => {
      acc[domain] = {
        domain,
        signals: [],
        concerns: [],
        preferences: [],
        sensitivities: [],
        goals: [],
        confidence: 0,
        confidenceLevel: 'low',
      };
      return acc;
    },
    {} as Record<BeautyDomain, DomainBeautyProfile>,
  );
}

function getSignalCategories(type: string, key: string): SignalCategories {
  const normalizedType = normalizeDomainKey(type) || '';
  const inferred = INFERRED_CATEGORIES[key] || {};

  return {
    concerns: normalizedType.includes('concern') || Boolean(inferred.concerns),
    preferences:
      normalizedType.includes('preference') || Boolean(inferred.preferences),
    sensitivities:
      normalizedType.includes('sensitivity') || Boolean(inferred.sensitivities),
    goals: normalizedType.includes('goal') || Boolean(inferred.goals),
  };
}

function mergeCategories(a: SignalCategories, b: SignalCategories) {
  return {
    concerns: a.concerns || b.concerns,
    preferences: a.preferences || b.preferences,
    sensitivities: a.sensitivities || b.sensitivities,
    goals: a.goals || b.goals,
  };
}

function collectDomainSignals(
  domains: Record<BeautyDomain, DomainBeautyProfile>,
  key: 'concerns' | 'preferences' | 'sensitivities' | 'goals',
) {
  const signals = BEAUTY_DOMAINS.flatMap((domain) => domains[domain][key]);
  sortSignals(signals);

  return signals;
}

function calculateDomainConfidence(signals: BeautyProfileSignal[]) {
  if (!signals.length) return 0;

  const averageConfidence =
    signals.reduce((sum, signal) => sum + signal.confidence, 0) /
    signals.length;
  const signalBoost = Math.min(0.12, (signals.length - 1) * 0.04);

  return roundConfidence(clamp(averageConfidence + signalBoost));
}

function calculateOverallConfidence(
  domains: Record<BeautyDomain, DomainBeautyProfile>,
  totalFacts: number,
) {
  if (!totalFacts) return 0;

  const detectedDomainConfidences = BEAUTY_DOMAINS.map(
    (domain) => domains[domain].confidence,
  ).filter((confidence) => confidence > 0);
  const averageConfidence =
    detectedDomainConfidences.reduce((sum, confidence) => sum + confidence, 0) /
    detectedDomainConfidences.length;
  const factBoost = Math.min(0.08, Math.max(0, totalFacts - 1) * 0.02);

  return roundConfidence(clamp(averageConfidence + factBoost));
}

function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.75) return 'high';
  if (confidence >= 0.45) return 'medium';
  return 'low';
}

function getSignalLabel(key: string) {
  return SIGNAL_LABELS[key] ?? titleCase(key.replace(/_/g, ' '));
}

function titleCase(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function sortSignals(signals: BeautyProfileSignal[]) {
  signals.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    if (b.evidenceCount !== a.evidenceCount) {
      return b.evidenceCount - a.evidenceCount;
    }

    return a.key.localeCompare(b.key);
  });
}

function getFactCreatedAt(fact: CustomerFact) {
  return fact.createdAt instanceof Date ? fact.createdAt : undefined;
}

function getNewestDate(
  current: string | Date | undefined,
  candidate: string | Date | undefined,
) {
  if (!current) return candidate;
  if (!candidate) return current;

  return new Date(candidate).getTime() > new Date(current).getTime()
    ? candidate
    : current;
}

function normalizeConfidence(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0.5;
  if (value <= 1) return clamp(value);

  return clamp(value / 100);
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function roundConfidence(value: number) {
  return Math.round(value * 100) / 100;
}
