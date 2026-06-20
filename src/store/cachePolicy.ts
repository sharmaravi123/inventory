/** Reuse Redux list data for this long before refetching on navigation (ms). */
export const LIST_CACHE_MS = 120_000;

export type FetchWithForce = void | { force?: boolean };

export function isForceFetch(arg: unknown): boolean {
  return (
    typeof arg === "object" &&
    arg !== null &&
    "force" in arg &&
    Boolean((arg as { force?: boolean }).force)
  );
}

/** When true, skip starting a new list fetch (use cached Redux data). */
export function shouldSkipListFetch(
  loading: boolean,
  itemCount: number,
  lastFetchedAt: number | null,
  arg?: unknown
): boolean {
  if (isForceFetch(arg)) return false;
  if (loading) return true;
  if (itemCount === 0 || lastFetchedAt === null) return false;
  return Date.now() - lastFetchedAt < LIST_CACHE_MS;
}

/** When true, skip refetching a single cached record. */
export function shouldSkipRecordFetch(
  loading: boolean,
  hasData: boolean,
  lastFetchedAt: number | null,
  arg?: unknown
): boolean {
  if (isForceFetch(arg)) return false;
  if (loading) return true;
  if (!hasData || lastFetchedAt === null) return false;
  return Date.now() - lastFetchedAt < LIST_CACHE_MS;
}
