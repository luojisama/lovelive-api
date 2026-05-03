import type { ApiMeta } from "../types";

export function ok<T>(data: T, meta: ApiMeta = {}, init?: ResponseInit): Response {
  const body = JSON.stringify({ data, meta });
  return new Response(body, {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60",
      ...init?.headers
    }
  });
}

export function fail(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export function notFound(message = "资源不存在"): Response {
  return fail(404, "NOT_FOUND", message);
}
