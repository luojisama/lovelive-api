const baseUrl = process.env.LOVELIVE_API_URL ?? "http://localhost:8787";

const response = await fetch(`${baseUrl}/v1/characters`);
if (!response.ok) {
  throw new Error(`角色接口返回 ${response.status}`);
}

const payload = await response.json();
const characters = payload.data;
if (!Array.isArray(characters) || characters.length === 0) {
  throw new Error("角色接口没有返回角色数据");
}

const problems = [];
for (const character of characters) {
  if (!character.id) problems.push("存在缺少 id 的角色");
  if (!character.names?.zhHans) problems.push(`${character.id} 缺少简体中文名`);
  if (!character.birthday?.month || !character.birthday?.day) problems.push(`${character.id} 缺少生日`);
  if (!character.color?.hex) problems.push(`${character.id} 缺少印象色 hex`);
  if (!character.sourceUrl?.includes("moegirl.org.cn")) problems.push(`${character.id} 来源不是萌娘百科`);
  if (!character.avatarUrl) {
    problems.push(`${character.id} 缺少头像 URL`);
    continue;
  }
  const avatar = await fetch(character.avatarUrl, { method: "GET" });
  const contentType = avatar.headers.get("content-type") ?? "";
  if (!avatar.ok || !contentType.startsWith("image/")) {
    problems.push(`${character.id} 头像不可用：${avatar.status} ${contentType}`);
  }
}

if (problems.length > 0) {
  throw new Error(`角色数据检查失败：\n${problems.join("\n")}`);
}

console.log(`角色数据检查通过：${characters.length} 个角色，头像 URL 全部可用。`);
