import { Injectable } from '@nestjs/common';

export type AiArmanApprovedLearning = {
  id: string;
  createdAt: string;
  createdBy: string;
  caseType: string;
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

  async listRelevant(caseType: string): Promise<AiArmanModelLearning[]> {
    const config = storageConfig();
    if (!config) return [];
    const envelope = await this.readCachedEnvelope(config);
    const normalizedType = clean(caseType, 80).toLowerCase();
    return envelope.lessons
      .filter((lesson) => !normalizedType || !lesson.caseType || lesson.caseType === normalizedType)
      .slice(-MAX_RELEVANT_LESSONS)
      .map(projectForModel);
  }

  async save(input: Omit<AiArmanApprovedLearning, 'id' | 'createdAt'>): Promise<AiArmanApprovedLearning> {
    const config = storageConfig();
    if (!config) throw new Error('admin_learning_storage_not_configured');

    const approvedReplyExample = clean(input.approvedReplyExample, 1200);
    const internalRationale = clean(input.internalRationale, 800);
    const lesson: AiArmanApprovedLearning = {
      id: 'learn-' + crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      createdBy: clean(input.createdBy, 120),
      caseType: clean(input.caseType, 80).toLowerCase(),
      principle: clean(input.principle, 800),
      appliesWhen: clean(input.appliesWhen, 500),
      avoid: clean(input.avoid, 500),
      ...(approvedReplyExample ? { approvedReplyExample } : {}),
      ...(internalRationale ? { internalRationale } : {}),
    };
    if (!lesson.createdBy || !lesson.principle) throw new Error('invalid_admin_learning');

    for (let attempt = 0; attempt < 3; attempt += 1) {
      // Saves intentionally bypass the read cache so optimistic concurrency always
      // uses the current GCS generation. The hot read path remains cached.
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
      return {
        id: clean(item.id, 120),
        createdAt: clean(item.createdAt, 64),
        createdBy: clean(item.createdBy, 120),
        caseType: clean(item.caseType, 80).toLowerCase(),
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

function clean(value: unknown, max: number): string {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, max);
}
