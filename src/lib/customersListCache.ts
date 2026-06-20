import type { FetchWithForce } from "@/store/cachePolicy";
import { isForceFetch, LIST_CACHE_MS } from "@/store/cachePolicy";

type CustomersCache = {
  data: unknown[];
  at: number;
};

let cache: CustomersCache | null = null;

export function readCustomersCache(): unknown[] | null {
  if (!cache) return null;
  if (Date.now() - cache.at > LIST_CACHE_MS) {
    cache = null;
    return null;
  }
  return cache.data;
}

export function writeCustomersCache(data: unknown[]): void {
  cache = { data, at: Date.now() };
}

export function invalidateCustomersCache(): void {
  cache = null;
}

export function shouldSkipCustomersFetch(arg?: FetchWithForce): boolean {
  if (isForceFetch(arg)) return false;
  return readCustomersCache() !== null;
}
