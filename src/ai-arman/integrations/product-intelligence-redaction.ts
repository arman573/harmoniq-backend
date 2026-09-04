const REDACTED_VALUE = '[REDACTED]';

export function redactProductIntelligenceResponseSecrets(
  value: unknown,
  headers: Record<string, string>,
): unknown {
  const secrets = collectAuthorizationSecrets(headers);
  if (secrets.length === 0) return value;
  return redactValue(value, secrets);
}

function collectAuthorizationSecrets(
  headers: Record<string, string>,
): string[] {
  const secrets = new Set<string>();

  for (const [name, rawValue] of Object.entries(headers)) {
    if (name.toLowerCase() !== 'authorization') continue;

    const value = String(rawValue || '').trim();
    if (!value) continue;

    secrets.add(value);
    const bearer = /^Bearer\s+(.+)$/i.exec(value)?.[1]?.trim();
    if (bearer) secrets.add(bearer);
  }

  return [...secrets].sort((a, b) => b.length - a.length);
}

function redactValue(value: unknown, secrets: string[]): unknown {
  if (typeof value === 'string') {
    return secrets.reduce(
      (text, secret) => text.split(secret).join(REDACTED_VALUE),
      value,
    );
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, secrets));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        redactValue(nested, secrets),
      ]),
    );
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
