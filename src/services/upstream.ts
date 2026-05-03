export async function fetchText(url: string, ttlSeconds: number): Promise<string> {
  const cache = (globalThis.caches as unknown as { default?: Cache } | undefined)?.default;
  const request = new Request(url, {
    headers: {
      "user-agent": "lovelive-api/0.1 (+https://workers.cloudflare.com)"
    }
  });

  if (cache) {
    const cached = await cache.match(request);
    if (cached) return cached.text();
  }

  const response = await fetch(request);
  if (!response.ok) {
    throw new Error(`Upstream ${url} returned ${response.status}`);
  }
  const text = await response.text();

  if (cache) {
    await cache.put(
      request,
      new Response(text, {
        headers: {
          "cache-control": `public, max-age=${ttlSeconds}`,
          "content-type": response.headers.get("content-type") ?? "text/plain"
        }
      })
    );
  }

  return text;
}
