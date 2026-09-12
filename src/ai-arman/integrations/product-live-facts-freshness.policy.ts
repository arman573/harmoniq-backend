export const PRODUCT_LIVE_FACTS_MAX_AGE_MS = 5 * 60 * 1000;
export const PRODUCT_LIVE_FACTS_MAX_FUTURE_SKEW_MS = 60 * 1000;

export type ProductLiveFactsFreshnessRejectionReason =
  | 'invalid_live_facts_timestamp'
  | 'stale_live_facts'
  | 'future_live_facts_timestamp';

export function getProductLiveFactsFreshnessRejectionReason(
  fetchedAt: unknown,
  nowMs = Date.now(),
): ProductLiveFactsFreshnessRejectionReason | null {
  const parsed = Date.parse(String(fetchedAt || ''));
  if (!Number.isFinite(parsed)) return 'invalid_live_facts_timestamp';

  if (nowMs - parsed > PRODUCT_LIVE_FACTS_MAX_AGE_MS) {
    return 'stale_live_facts';
  }

  if (parsed - nowMs > PRODUCT_LIVE_FACTS_MAX_FUTURE_SKEW_MS) {
    return 'future_live_facts_timestamp';
  }

  return null;
}
