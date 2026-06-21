import type { FetchWithForce } from "@/store/cachePolicy";
import { isForceFetch, LIST_CACHE_MS } from "@/store/cachePolicy";

type CustomersCachePayload =
  | unknown[]
  | { customers?: unknown[]; idAliases?: Record<string, string> };

type CustomersCache = {
  data: CustomersCachePayload;
  at: number;
};

let cache: CustomersCache | null = null;

export function readCustomersCache(): CustomersCachePayload | null {
  if (!cache) return null;
  if (Date.now() - cache.at > LIST_CACHE_MS) {
    cache = null;
    return null;
  }
  return cache.data;
}

export function writeCustomersCache(data: CustomersCachePayload): void {
  cache = { data, at: Date.now() };
}

export function invalidateCustomersCache(): void {
  cache = null;
}

export function shouldSkipCustomersFetch(arg?: FetchWithForce): boolean {
  if (isForceFetch(arg)) return false;
  return readCustomersCache() !== null;
}
