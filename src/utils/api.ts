import type { ApiMeta } from "../types";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400"
} as const;

export function ok<T>(data: T, meta: ApiMeta = {}, init?: ResponseInit): Response {
  const body = JSON.stringify({ data, meta });
  return new Response(body, {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60",
      ...CORS_HEADERS,
      ...init?.headers
    }
  });
}

export function fail(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...CORS_HEADERS
    }
  });
}

export function notFound(message = "资源不存在"): Response {
  return fail(404, "NOT_FOUND", message);
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: { ...CORS_HEADERS } });
}
