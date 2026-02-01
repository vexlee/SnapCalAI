/**
 * In-Memory Cache Utility
 * Provides fast data caching with TTL (time-to-live) and manual invalidation
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number; // Time to live in milliseconds
}

class DataCache {
    private cache: Map<string, CacheEntry<any>> = new Map();
    private defaultTTL = 5 * 60 * 1000; // 5 minutes default

    /**
     * Get cached data if it exists and hasn't expired
     */
    get<T>(key: string): T | null {
        const entry = this.cache.get(key);

        if (!entry) return null;

        const now = Date.now();
        const age = now - entry.timestamp;

        // Check if expired
        if (age > entry.ttl) {
            this.cache.delete(key);
            return null;
        }

        return entry.data as T;
    }

    /**
     * Set cache data with optional custom TTL
     */
    set<T>(key: string, data: T, ttlMs?: number): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: ttlMs || this.defaultTTL
        });
    }

    /**
     * Check if cache has valid (non-expired) data for key
     */
    has(key: string): boolean {
        return this.get(key) !== null;
    }

    /**
     * Invalidate specific cache key
     */
    invalidate(key: string): void {
        this.cache.delete(key);
    }

    /**
     * Invalidate all cache keys matching a pattern
     */
    invalidatePattern(pattern: RegExp): void {
        const keysToDelete: string[] = [];

        this.cache.forEach((_, key) => {
            if (pattern.test(key)) {
                keysToDelete.push(key);
            }
        });

        keysToDelete.forEach(key => this.cache.delete(key));
    }

    /**
     * Clear all cached data
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Invalidate all caches that are date-sensitive (used at midnight)
     */
    clearDateSensitiveCaches(): void {
        console.log('🗑️ Clearing date-sensitive caches...');
        // Clear all food-related caches as they are date-dependent
        this.invalidatePattern(/^food:/);
        // User profile and settings can persist across days
        console.log('✅ Date-sensitive caches cleared');
    }

    /**
     * Get cache statistics
     */
    getStats(): { size: number; keys: string[] } {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

// Singleton instance
export const cache = new DataCache();

// Cache key constants for consistency
export const CACHE_KEYS = {
    ENTRIES: 'food:entries',
    ENTRIES_LITE: 'food:entries:lite',
    DAILY_SUMMARIES: 'food:summaries',
    DAILY_SUMMARIES_LITE: 'food:summaries:lite',
    DAILY_GOAL: 'user:goal',
    USER_PROFILE: 'user:profile',
    // Engagement system keys
    STREAK_DATA: 'user:streak',
    AVATAR_STATE: 'user:avatar',
    WEIGHT_GOAL: 'user:weight-goal',
    // Dynamic keys
    entriesForDate: (date: string) => `food:entries:${date}`,
    entryImage: (id: string) => `food:image:${id}`,
    summariesForRange: (start: string, end: string) => `food:summaries:${start}:${end}`,
} as const;

/**
 * Helper function to wrap async functions with caching
 */
export async function withCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs?: number
): Promise<T> {
    // Try to get from cache first
    const cached = cache.get<T>(key);
    if (cached !== null) {
        return cached;
    }

    // Cache miss - fetch data
    const data = await fetcher();

    // Store in cache
    cache.set(key, data, ttlMs);

    return data;
}
