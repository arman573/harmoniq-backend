import { Injectable } from '@nestjs/common';

export type AiArmanLearningScenario =
  | 'stock_shortage'
  | 'supplier_delay'
  | 'tracking'
  | 'general';

export type AiArmanApprovedLearning = {
  id: string;
  createdAt: string;
  createdBy: string;
  caseType: string;
  scenario?: AiArmanLearningScenario;
  principle: string;
  appliesWhen: string;
  avoid: string;
  approvedReplyExample?: string;
  internalRationale?: string;
};

export type AiArmanModelLearning = Omit<AiArmanApprovedLearning, 'internalRationale'>;

const MAX_LESSONS = 500;
const MAX_RELEVANT_LESSONS = 8;
const MAX_BYTES = 512_000;
const LEARNING_CACHE_TTL_MS = 5 * 60 * 1000;
const TOKEN_REFRESH_SKEW_MS = 60 * 1000;

type LearningEnvelope = {
  lessons: AiArmanApprovedLearning[];
  generation: string;
};

type LearningCache = {
  key: string;
  expiresAt: number;
  envelope: LearningEnvelope;
};

let metadataTokenCache: { token: string; expiresAt: number } | null = null;

@Injectable()
export class AiArmanAdminLearningStore {
  private cache: LearningCache | null = null;
  private inFlightRead: Promise<LearningEnvelope> | null = null;
  private inFlightKey = '';

  async listRelevant(caseType: string, currentContext?: unknown): Promise<AiArmanModelLearning[]> {
    const config = storageConfig();
    if (!config) return [];
    const envelope = await this.readCachedEnvelope(config);
    const normalizedType = clean(caseType, 80).toLowerCase();
    const currentScenario = detectLearningScenario(currentContext);

    return envelope.lessons
      .map((lesson, index) => ({
        lesson,
        index,
        score: relevanceScore(lesson, normalizedType, currentScenario),
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score || right.index - left.index)
      .slice(0, MAX_RELEVANT_LESSONS)
      .sort((left, right) => left.index - right.index)
      .map((entry) => projectForModel(entry.lesson));
  }

  async save(input: Omit<AiArmanApprovedLearning, 'id' | 'createdAt'>): Promise<AiArmanApprovedLearning> {
    const config = storageConfig();
    if (!config) throw new Error('admin_learning_storage_not_configured');

    const approvedReplyExample = clean(input.approvedReplyExample, 1200);
    const internalRationale = clean(input.internalRationale, 800);
    const scenario = normalizeScenario(input.scenario);
    const lesson: AiArmanApprovedLearning = {
      id: 'learn-' + crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      createdBy: clean(input.createdBy, 120),
      caseType: clean(input.caseType, 80).toLowerCase(),
      ...(scenario ? { scenario } : {}),
      principle: clean(input.principle, 800),
      appliesWhen: clean(input.appliesWhen, 500),
      avoid: clean(input.avoid, 500),
      ...(approvedReplyExample ? { approvedReplyExample } : {}),
      ...(internalRationale ? { internalRationale } : {}),
    };
    if (!lesson.createdBy || !lesson.principle) throw new Error('invalid_admin_learning');

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const current = await readEnvelope(config);
      const lessons = [...current.lessons, lesson].slice(-MAX_LESSONS);
      const saved = await writeEnvelope(config, lessons, current.generation);
      if (saved) {
        this.cache = {
          key: configKey(config),
          expiresAt: Date.now() + LEARNING_CACHE_TTL_MS,
          envelope: { lessons, generation: current.generation },
        };
        return lesson;
      }
    }
    throw new Error('admin_learning_concurrent_update');
  }

  private async readCachedEnvelope(config: { bucket: string; object: string }): Promise<LearningEnvelope> {
    const key = configKey(config);
    const now = Date.now();
    if (this.cache?.key === key && this.cache.expiresAt > now) {
      return this.cache.envelope;
    }

    if (this.inFlightRead && this.inFlightKey === key) {
      return this.inFlightRead;
    }

    this.inFlightKey = key;
    this.inFlightRead = readEnvelope(config)
      .then((envelope) => {
        this.cache = {
          key,
          expiresAt: Date.now() + LEARNING_CACHE_TTL_MS,
          envelope,
        };
        return envelope;
      })
      .finally(() => {
        if (this.inFlightKey === key) {
          this.inFlightRead = null;
          this.inFlightKey = '';
        }
      });

    return this.inFlightRead;
  }
}

export function detectLearningScenario(value: unknown): AiArmanLearningScenario {
  if (hasVerifiedStockShortage(value)) return 'stock_shortage';

  const text = normalizeForMatching(JSON.stringify(value ?? ''));
  if (/\b(tracking|sparning|sparningslank|sandningsid|sandnings-id|paketid|paket-id)\b/.test(text)) {
    return 'tracking';
  }
  if (/\b(leverantor|inleverans|restnot|restorder|forsenad fran leverantor|forsening fran leverantor)\b/.test(text)) {
    return 'supplier_delay';
  }
  return 'general';
}

function relevanceScore(
  lesson: AiArmanApprovedLearning,
  caseType: string,
  scenario: AiArmanLearningScenario,
): number {
  const lessonScenario = normalizeScenario(lesson.scenario) || inferLegacyScenario(lesson);
  const sameType = Boolean(caseType && lesson.caseType && lesson.caseType === caseType);
  const genericType = !lesson.caseType;
  const exactScenario = lessonScenario === scenario && scenario !== 'general';
  const genericScenario = !lessonScenario || lessonScenario === 'general';

  if (exactScenario) return 100 + (sameType ? 20 : genericType ? 10 : 0);
  if (sameType && genericScenario) return 20;
  if (genericType && genericScenario) return 10;
  if (scenario === 'general' && sameType) return 15;
  return 0;
}

function hasVerifiedStockShortage(value: unknown): boolean {
  const seen = new WeakSet<object>();
  function visit(input: unknown, depth = 0): boolean {
    if (depth > 12 || input === null || input === undefined) return false;
    if (Array.isArray(input)) return input.some((item) => visit(item, depth + 1));
    if (!isRecord(input)) return false;
    if (seen.has(input)) return false;
    seen.add(input);

    if (input.stockVerified === true) {
      const stock = finiteNonNegative(input.stockQuantity);
      const ordered = finiteNonNegative(input.orderedQuantity ?? input.quantity);
      const shortfall = finiteNonNegative(input.shortfallQuantity);
      if (shortfall !== null && shortfall > 0) return true;
      if (stock !== null && ordered !== null && stock < ordered) return true;
      if (input.canFulfillOrderedQuantity === false && stock !== null) return true;
    }

    return Object.values(input).some((item) => visit(item, depth + 1));
  }
  return visit(value);
}

function inferLegacyScenario(lesson: AiArmanApprovedLearning): AiArmanLearningScenario | '' {
  const text = normalizeForMatching(`${lesson.principle} ${lesson.appliesWhen} ${lesson.avoid}`);
  if (/\b(lager|lagersaldo|stockverified|stockquantity|bestallda antal|bestallt antal)\b/.test(text)) {
    return 'stock_shortage';
  }
  if (/\b(leverantor|inleverans|restnot|restorder)\b/.test(text)) return 'supplier_delay';
  if (/\b(tracking|sparning|sandningsid|paketstatus)\b/.test(text)) return 'tracking';
  return '';
}

function projectForModel(lesson: AiArmanApprovedLearning): AiArmanModelLearning {
  const {
    internalRationale: _privateInternalRationale,
    ...safeLearning
  } = lesson;
  return safeLearning;
}

function storageConfig() {
  const bucket = String(process.env.AI_ARMAN_LEARNING_GCS_BUCKET || '').trim();
  const object = String(process.env.AI_ARMAN_LEARNING_GCS_OBJECT || 'ai-arman/support-learning-v1.json').trim();
  if (!bucket || !object) return null;
  return { bucket, object };
}

function configKey(config: { bucket: string; object: string }) {
  return `${config.bucket}/${config.object}`;
}

async function readEnvelope(config: { bucket: string; object: string }): Promise<LearningEnvelope> {
  const token = await metadataAccessToken();
  const metadataUrl = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(config.bucket)}/o/${encodeURIComponent(config.object)}`;
  const metadataResponse = await fetch(metadataUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (metadataResponse.status === 404) return { lessons: [], generation: '0' };
  if (!metadataResponse.ok) throw new Error('admin_learning_metadata_read_failed');
  const metadata = await metadataResponse.json() as { generation?: string };

  const response = await fetch(metadataUrl + '?alt=media', { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error('admin_learning_read_failed');
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_BYTES) throw new Error('admin_learning_too_large');
  const parsed = JSON.parse(text) as { lessons?: unknown };
  return {
    lessons: normalizeLessons(parsed.lessons),
    generation: String(metadata.generation || ''),
  };
}

async function writeEnvelope(
  config: { bucket: string; object: string },
  lessons: AiArmanApprovedLearning[],
  generation: string,
): Promise<boolean> {
  const token = await metadataAccessToken();
  const body = JSON.stringify({ version: 'ai-arman-support-learning-v1', lessons });
  if (Buffer.byteLength(body, 'utf8') > MAX_BYTES) throw new Error('admin_learning_too_large');
  const query = new URLSearchParams({ uploadType: 'media', name: config.object, ifGenerationMatch: generation || '0' });
  const response = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(config.bucket)}/o?${query.toString()}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body,
  });
  if (response.status === 412) return false;
  if (!response.ok) throw new Error('admin_learning_write_failed');
  return true;
}

async function metadataAccessToken(): Promise<string> {
  const now = Date.now();
  if (metadataTokenCache && metadataTokenCache.expiresAt - TOKEN_REFRESH_SKEW_MS > now) {
    return metadataTokenCache.token;
  }

  const response = await fetch(
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
    { headers: { 'Metadata-Flavor': 'Google' } },
  );
  if (!response.ok) throw new Error('admin_learning_identity_unavailable');
  const body = await response.json() as { access_token?: string; expires_in?: number };
  const token = String(body.access_token || '').trim();
  if (!token) throw new Error('admin_learning_identity_unavailable');

  const expiresInSeconds = Number(body.expires_in);
  const lifetimeMs = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
    ? expiresInSeconds * 1000
    : 5 * 60 * 1000;
  metadataTokenCache = { token, expiresAt: now + lifetimeMs };
  return token;
}

function normalizeLessons(value: unknown): AiArmanApprovedLearning[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map((item) => {
      const approvedReplyExample = clean(item.approvedReplyExample, 1200);
      const internalRationale = clean(item.internalRationale, 800);
      const scenario = normalizeScenario(item.scenario);
      return {
        id: clean(item.id, 120),
        createdAt: clean(item.createdAt, 64),
        createdBy: clean(item.createdBy, 120),
        caseType: clean(item.caseType, 80).toLowerCase(),
        ...(scenario ? { scenario } : {}),
        principle: clean(item.principle, 800),
        appliesWhen: clean(item.appliesWhen, 500),
        avoid: clean(item.avoid, 500),
        ...(approvedReplyExample ? { approvedReplyExample } : {}),
        ...(internalRationale ? { internalRationale } : {}),
      };
    })
    .filter((item) => item.id && item.createdAt && item.createdBy && item.principle)
    .slice(-MAX_LESSONS);
}

function normalizeScenario(value: unknown): AiArmanLearningScenario | '' {
  const scenario = clean(value, 40).toLowerCase();
  return scenario === 'stock_shortage' ||
    scenario === 'supplier_delay' ||
    scenario === 'tracking' ||
    scenario === 'general'
    ? scenario
    : '';
}

function finiteNonNegative(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeForMatching(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_.,\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clean(value: unknown, max: number): string {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, max);
}
