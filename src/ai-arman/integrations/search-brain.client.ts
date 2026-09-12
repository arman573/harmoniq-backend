import { Injectable } from '@nestjs/common';
import {
  SearchBrainAutocompleteResponse,
  SearchBrainLookupResult,
} from './search-brain.types';

const DEFAULT_TIMEOUT_MS = 800;

@Injectable()
export class SearchBrainClient {
  async autocomplete(query: string): Promise<SearchBrainLookupResult> {
    const normalizedQuery = String(query || '').trim();
    const baseUrl = String(process.env.SEARCH_BRAIN_BASE_URL || '')
      .trim()
      .replace(/\/$/, '');

    if (!baseUrl) {
      return {
        ok: false,
        configured: false,
        query: normalizedQuery,
        durationMs: 0,
        products: [],
        error: 'search_brain_not_configured',
      };
    }

    const timeoutMs = this.readTimeout();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();

    try {
      const response = await fetch(
        `${baseUrl}/autocomplete?q=${encodeURIComponent(normalizedQuery)}`,
        {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        },
      );

      const body = (await response.json()) as SearchBrainAutocompleteResponse;

      return {
        ok: response.ok && body?.ok === true,
        configured: true,
        query: normalizedQuery,
        durationMs: Date.now() - startedAt,
        upstreamStatus: response.status,
        products: Array.isArray(body?.products) ? body.products : [],
        navigationTarget: body?.navigationTarget,
        error: response.ok ? undefined : 'search_brain_upstream_error',
      };
    } catch (error) {
      return {
        ok: false,
        configured: true,
        query: normalizedQuery,
        durationMs: Date.now() - startedAt,
        products: [],
        error:
          error instanceof Error && error.name === 'AbortError'
            ? 'search_brain_timeout'
            : 'search_brain_request_failed',
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private readTimeout(): number {
    const configured = Number(process.env.SEARCH_BRAIN_TIMEOUT_MS);
    if (!Number.isFinite(configured)) return DEFAULT_TIMEOUT_MS;
    return Math.min(2000, Math.max(200, configured));
  }
}
