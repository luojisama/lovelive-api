export async function fetchText(url: string, ttlSeconds: number): Promise<string> {
  const cache = (globalThis.caches as unknown as { default?: Cache } | undefined)?.default;
  const request = new Request(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 lovelive-api/0.1",
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ja,en-US;q=0.9,en;q=0.8,zh-CN;q=0.7",
      "referer": "https://www.lovelive-anime.jp/"
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
