import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const entries = [
  ["characters:normalized:v2", join(root, "src", "fixtures", "characters.json"), 7 * 24 * 60 * 60],
  ["events:normalized:v7", join(root, "src", "fixtures", "events.json"), 3 * 60 * 60],
  ["music:official:v3", join(root, "src", "fixtures", "music.json"), 24 * 60 * 60]
];

const tempDir = mkdtempSync(join(tmpdir(), "lovelive-api-seed-"));

for (const [key, file, ttlSeconds] of entries) {
  const now = new Date();
  const envelope = {
    data: JSON.parse(readFileSync(file, "utf8")),
    refreshedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
    source: "fixture"
  };
  const envelopeFile = join(tempDir, `${key.replace(/[:]/g, "-")}.json`);
  writeFileSync(envelopeFile, JSON.stringify(envelope), "utf8");

  const result = spawnSync(
    "pnpm",
    ["wrangler", "kv", "key", "put", key, "--path", envelopeFile, "--binding", "CACHE", "--env", "local", "--local"],
    { cwd: root, stdio: "inherit", shell: process.platform === "win32" }
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
