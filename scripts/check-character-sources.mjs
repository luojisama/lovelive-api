const baseUrl = process.env.LOVELIVE_API_URL ?? "http://localhost:8787";

const response = await fetch(`${baseUrl}/v1/characters`);
if (!response.ok) {
  throw new Error(`角色接口返回 ${response.status}`);
}

const { data: characters } = await response.json();
const problems = [];
let colorChecks = 0;

for (const character of characters) {
  const source = await fetch(character.sourceUrl, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!source.ok) {
    problems.push(`${character.id} 萌娘百科来源页不可访问：${source.status}`);
    continue;
  }

  const html = await source.text();
  const birthdayText = stripTags(html.match(/<th[^>]*>\s*生日\s*<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/)?.[1]);
  const birthday = birthdayText?.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (!birthday) {
    problems.push(`${character.id} 萌娘百科来源页未解析到生日`);
  } else if (Number(birthday[1]) !== character.birthday?.month || Number(birthday[2]) !== character.birthday?.day) {
    problems.push(`${character.id} 生日与萌娘百科不一致：API ${character.birthday?.text}，来源 ${birthdayText}`);
  }

  const nameCell = html.match(/<span itemprop="name">([\s\S]*?)<\/span>\s*<\/td>/)?.[1] ?? "";
  const colorHex = nameCell.match(/title="(#[0-9a-fA-F]{6})"/)?.[1] ?? nameCell.match(/background:\s*(#[0-9a-fA-F]{6})/)?.[1];
  if (colorHex) {
    colorChecks += 1;
    if (colorHex.toLowerCase() !== character.color?.hex?.toLowerCase()) {
      problems.push(`${character.id} 印象色与萌娘百科姓名色块不一致：API ${character.color?.hex}，来源 ${colorHex}`);
    }
  }
}

if (problems.length > 0) {
  throw new Error(`角色来源核对失败：\n${problems.join("\n")}`);
}

console.log(`角色来源核对通过：${characters.length} 个角色生日与萌娘百科一致，${colorChecks} 个角色色块与萌娘百科一致。`);

function stripTags(html) {
  return html?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
