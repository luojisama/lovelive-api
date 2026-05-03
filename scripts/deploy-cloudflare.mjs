import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const configPath = join(root, "wrangler.toml");
const args = new Set(process.argv.slice(2));
const env = readOption("--env") ?? "production";
const binding = readOption("--binding") ?? "CACHE";
const kvName = readOption("--kv-name") ?? `lovelive-api-${env}-cache`;
const skipChecks = args.has("--skip-checks");
const withDataChecks = args.has("--with-data-checks");

main();

function main() {
  console.log(`准备部署到 Cloudflare Workers：env=${env}`);

  if (!skipChecks) {
    run("pnpm", ["typecheck"]);
    run("pnpm", ["test"]);
    if (withDataChecks) {
      run("pnpm", ["check:data"]);
      run("pnpm", ["check:sources"]);
    }
  }

  ensureWranglerLogin();
  const namespaceId = process.env.CF_KV_NAMESPACE_ID ?? ensureKvNamespace();
  ensureKvBinding(namespaceId);
  run("wrangler", ["deploy", "--env", env]);
}

function ensureWranglerLogin() {
  const result = run("wrangler", ["whoami"], { capture: true, allowFailure: true });
  if (result.status === 0) {
    return;
  }

  if (process.env.CLOUDFLARE_API_TOKEN) {
    throw new Error("检测到 CLOUDFLARE_API_TOKEN，但 wrangler whoami 失败。请检查 token 权限。");
  }

  console.log("未检测到 Cloudflare 登录状态，开始执行 wrangler login。");
  run("wrangler", ["login"]);
}

function ensureKvNamespace() {
  const config = readFileSync(configPath, "utf8");
  const existingId = readKvBindingId(config);
  if (existingId && !existingId.startsWith("replace_with_")) {
    console.log(`复用 wrangler.toml 中已有 KV namespace：${existingId}`);
    return existingId;
  }

  const listed = findKvNamespace(kvName);
  if (listed) {
    console.log(`复用已存在 KV namespace：${kvName} (${listed.id})`);
    return listed.id;
  }

  console.log(`创建 KV namespace：${kvName}`);
  const created = run("wrangler", ["kv", "namespace", "create", kvName, "--env", env, "--binding", binding], { capture: true });
  const id = parseCreatedNamespaceId(`${created.stdout}\n${created.stderr}`);
  if (!id) {
    throw new Error("已创建 KV namespace，但无法从 Wrangler 输出中解析 id。请手动把输出中的 id 写入 wrangler.toml。");
  }
  return id;
}

function findKvNamespace(name) {
  const result = run("wrangler", ["kv", "namespace", "list"], { capture: true });
  const output = result.stdout.trim();
  if (!output) return undefined;

  try {
    const namespaces = JSON.parse(output);
    return namespaces.find((namespace) => namespace.title === name);
  } catch {
    return undefined;
  }
}

function ensureKvBinding(namespaceId) {
  const config = readFileSync(configPath, "utf8");
  const nextConfig = upsertKvBinding(config, namespaceId);
  if (nextConfig !== config) {
    writeFileSync(configPath, nextConfig, "utf8");
    console.log(`已更新 wrangler.toml：env.${env}.${binding} -> ${namespaceId}`);
  }
}

function upsertKvBinding(config, namespaceId) {
  const sectionPattern = new RegExp(
    `(\\[\\[env\\.${escapeRegex(env)}\\.kv_namespaces\\]\\][\\s\\S]*?binding\\s*=\\s*"${escapeRegex(binding)}"[\\s\\S]*?id\\s*=\\s*")([^"]*)(")`,
    "m"
  );

  if (sectionPattern.test(config)) {
    return config.replace(sectionPattern, `$1${namespaceId}$3`);
  }

  const block = `\n[[env.${env}.kv_namespaces]]\nbinding = "${binding}"\nid = "${namespaceId}"\n`;
  return `${config.trimEnd()}\n${block}`;
}

function readKvBindingId(config) {
  const match = config.match(
    new RegExp(
      `\\[\\[env\\.${escapeRegex(env)}\\.kv_namespaces\\]\\][\\s\\S]*?binding\\s*=\\s*"${escapeRegex(binding)}"[\\s\\S]*?id\\s*=\\s*"([^"]+)"`,
      "m"
    )
  );
  return match?.[1];
}

function parseCreatedNamespaceId(output) {
  return output.match(/id\s*=\s*"([^"]+)"/)?.[1] ?? output.match(/"id"\s*:\s*"([^"]+)"/)?.[1];
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: options.capture ? ["inherit", "pipe", "pipe"] : "inherit"
  });

  if (result.status !== 0 && !options.allowFailure) {
    const detail = options.capture ? `\n${result.stdout ?? ""}${result.stderr ?? ""}` : "";
    throw new Error(`命令执行失败：${command} ${commandArgs.join(" ")}${detail}`);
  }

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

function readOption(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
