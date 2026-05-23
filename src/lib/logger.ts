const MAX_MASK_DEPTH = 8;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function maskSensitiveData(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') {
    return value
      .replace(/(\+?\d[\d\s-]{6,}\d)/g, '[MASKED_PHONE]')
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[MASKED_EMAIL]');
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: maskSensitiveData(value.message, depth + 1),
    };
  }

  if (depth >= MAX_MASK_DEPTH) {
    return '[MAX_MASK_DEPTH]';
  }

  if (Array.isArray(value)) {
    return value.map((item) => maskSensitiveData(item, depth + 1));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        maskSensitiveData(entryValue, depth + 1),
      ]),
    );
  }

  return value;
}

export function logInfo(message: string, data?: unknown) {
  console.log(
    JSON.stringify({
      level: 'info',
      message,
      data: maskSensitiveData(data),
      timestamp: new Date().toISOString(),
    }),
  );
}

export function logError(message: string, error?: unknown) {
  console.error(
    JSON.stringify({
      level: 'error',
      message,
      error: maskSensitiveData(error),
      timestamp: new Date().toISOString(),
    }),
  );
}
