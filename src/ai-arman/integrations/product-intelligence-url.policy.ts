export function normalizeProductIntelligenceRequestBaseUrl(value: unknown): string | null {
  return normalizeHttpsOrigin(value);
}

export function normalizeProductIntelligenceAudience(value: unknown): string | null {
  return normalizeHttpsOrigin(value);
}

function normalizeHttpsOrigin(value: unknown): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    if (!url.hostname || url.username || url.password) return null;
    if (url.search || url.hash) return null;
    if (url.pathname !== '/' && url.pathname !== '') return null;
    return url.origin;
  } catch {
    return null;
  }
}
