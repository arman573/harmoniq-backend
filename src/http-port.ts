const DEFAULT_HTTP_PORT = 3000;
const MIN_PORT = 1;
const MAX_PORT = 65535;

export function resolveHttpPort(env: NodeJS.ProcessEnv = process.env): number {
  const raw = String(env.PORT || '').trim();
  if (!raw) return DEFAULT_HTTP_PORT;

  if (!/^\d{1,5}$/.test(raw)) return DEFAULT_HTTP_PORT;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < MIN_PORT || parsed > MAX_PORT) {
    return DEFAULT_HTTP_PORT;
  }

  return parsed;
}
