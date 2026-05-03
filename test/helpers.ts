import type { Env } from "../src/types";

export function createTestEnv(overrides: Partial<Env> = {}): Env {
  return {
    CACHE: createMemoryKV(),
    UPSTREAM_MODE: "fixture",
    RSSHUB_BASE_URL: "https://rsshub.app",
    ...overrides
  };
}

export function createMemoryKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    async get(key: string, options?: unknown): Promise<unknown> {
      const value = store.get(key);
      if (value == null) return null;
      if (options === "json" || (typeof options === "object" && options && "type" in options && options.type === "json")) {
        return JSON.parse(value);
      }
      return value;
    },
    async put(key: string, value: string): Promise<void> {
      store.set(key, value);
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    },
    async list(): Promise<KVNamespaceListResult<unknown, string>> {
      return {
        keys: [...store.keys()].map((name) => ({ name })),
        list_complete: true,
        cacheStatus: null
      };
    },
    async getWithMetadata(): Promise<unknown> {
      return { value: null, metadata: null, cacheStatus: null };
    }
  } as unknown as KVNamespace;
}
