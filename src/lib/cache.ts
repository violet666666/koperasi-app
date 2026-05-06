/**
 * Simple in-memory TTL cache for serverless functions.
 * Each Vercel function invocation gets its own isolate,
 * so this cache persists only within a single warm instance.
 */

const store = new Map<string, { data: unknown; expiry: number }>();

export function getCached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
    const entry = store.get(key);
    if (entry && Date.now() < entry.expiry) {
        return Promise.resolve(entry.data as T);
    }

    return fetcher().then((data) => {
        store.set(key, { data, expiry: Date.now() + ttlMs });
        return data;
    });
}

export function invalidateCache(prefix: string): void {
    for (const key of store.keys()) {
        if (key.startsWith(prefix)) store.delete(key);
    }
}
