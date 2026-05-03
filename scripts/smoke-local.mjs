const baseUrl = process.env.LOVELIVE_API_URL ?? "http://localhost:8787";

const checks = [
  ["/health", 200],
  ["/v1/characters?q=香音", 200],
  ["/v1/characters/kanon-shibuya", 200],
  ["/v1/birthdays/today?tz=Asia/Shanghai", 200],
  ["/v1/events?category=live", 200],
  ["/v1/music?q=Aspire", 200],
  ["/v1/cards/random?game=sif", 501]
];

for (const [path, expectedStatus] of checks) {
  const response = await fetch(`${baseUrl}${path}`);
  if (response.status !== expectedStatus) {
    const body = await response.text();
    throw new Error(`${path} expected ${expectedStatus}, got ${response.status}: ${body}`);
  }
  const json = await response.json();
  if (!json.data && !json.error) {
    throw new Error(`${path} did not return API envelope`);
  }
}

await checkFirstDetail("/v1/events?category=live", "/v1/events");
await checkFirstDetail("/v1/music?q=Aspire", "/v1/music");

console.log(`Smoke checks passed against ${baseUrl}`);

async function checkFirstDetail(listPath, detailPrefix) {
  const listResponse = await fetch(`${baseUrl}${listPath}`);
  const listJson = await listResponse.json();
  const id = listJson.data?.[0]?.id;
  if (!id) return;

  const detailResponse = await fetch(`${baseUrl}${detailPrefix}/${id}`);
  if (detailResponse.status !== 200) {
    const body = await detailResponse.text();
    throw new Error(`${detailPrefix}/${id} expected 200, got ${detailResponse.status}: ${body}`);
  }
}
