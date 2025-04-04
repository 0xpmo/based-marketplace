// utils/cacheStore.ts
// A simple in-memory cache store for app-wide data caching

// Cache types
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

// Main cache store with class-based interface
class CacheStore {
  private store: Record<string, CacheEntry<any>> = {};
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  // Set a value in the cache
  set<T>(key: string, value: T, ttl: number = this.defaultTTL): void {
    const now = Date.now();
    this.store[key] = {
      data: value,
      timestamp: now,
      expiresAt: now + ttl,
    };
  }

  // Get a value from cache
  get<T>(key: string): T | null {
    const entry = this.store[key];

    // Return null if entry doesn't exist
    if (!entry) return null;

    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      delete this.store[key];
      return null;
    }

    return entry.data as T;
  }

  // Check if key exists and is not expired
  has(key: string): boolean {
    const entry = this.store[key];
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      delete this.store[key];
      return false;
    }
    return true;
  }

  // Remove a key from cache
  delete(key: string): void {
    delete this.store[key];
  }

  // Delete all keys that match a prefix
  deleteByPrefix(prefix: string): void {
    Object.keys(this.store).forEach((key) => {
      if (key.startsWith(prefix)) {
        delete this.store[key];
      }
    });
  }

  // Clear entire cache
  clear(): void {
    this.store = {};
  }

  // Get all keys
  keys(): string[] {
    return Object.keys(this.store);
  }

  // Get all valid keys (not expired)
  validKeys(): string[] {
    const now = Date.now();
    return Object.keys(this.store).filter(
      (key) => this.store[key].expiresAt > now
    );
  }

  // Get cache stats
  stats(): { size: number; validItems: number } {
    const now = Date.now();
    const allKeys = Object.keys(this.store);
    const validItems = allKeys.filter(
      (key) => this.store[key].expiresAt > now
    ).length;

    return {
      size: allKeys.length,
      validItems,
    };
  }
}

// Export a singleton instance
export const appCache = new CacheStore();

// SWR configuration with our cache
export const swrConfiguration = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: 10000, // 10 seconds
  provider: () => new Map(),
};
