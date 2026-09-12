import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';

const SUBJECT_WINDOW_MS = 15 * 60 * 1000;
const SUBJECT_MAX_SENDS = 3;
const SUBJECT_COOLDOWN_MS = 60 * 1000;
const GLOBAL_WINDOW_MS = 60 * 1000;
const GLOBAL_MAX_SENDS = 30;

@Injectable()
export class AiArmanCustomerOtpRateLimiter {
  private readonly subjects = new Map<string, number[]>();
  private readonly global: number[] = [];

  allow(email: string, now = Date.now()): boolean {
    this.pruneGlobal(now);
    if (this.global.length >= GLOBAL_MAX_SENDS) return false;

    const key = hashSubject(email);
    const existing = (this.subjects.get(key) ?? []).filter(
      (timestamp) => timestamp > now - SUBJECT_WINDOW_MS,
    );
    this.subjects.set(key, existing);

    if (existing.length >= SUBJECT_MAX_SENDS) return false;
    const latest = existing.at(-1);
    if (latest !== undefined && latest > now - SUBJECT_COOLDOWN_MS) return false;

    existing.push(now);
    this.global.push(now);
    return true;
  }

  private pruneGlobal(now: number): void {
    while (this.global.length > 0 && this.global[0] <= now - GLOBAL_WINDOW_MS) {
      this.global.shift();
    }
    for (const [key, timestamps] of this.subjects) {
      const current = timestamps.filter(
        (timestamp) => timestamp > now - SUBJECT_WINDOW_MS,
      );
      if (current.length === 0) this.subjects.delete(key);
      else this.subjects.set(key, current);
    }
  }
}

function hashSubject(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}
