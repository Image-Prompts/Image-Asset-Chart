import { readdir, stat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const extensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif']);
const collator = new Intl.Collator('zh-CN', { numeric: true });

export async function scanAssets() {
  const base = path.join(root, 'assets');
  await mkdir(base, { recursive: true });
  const folders = (await readdir(base, { withFileTypes: true }))
    .filter(entry => entry.isDirectory()).sort((a, b) => collator.compare(a.name, b.name));
  const members = [];
  const images = [];
  for (const folder of folders) {
    const files = (await readdir(path.join(base, folder.name), { withFileTypes: true }))
      .filter(entry => entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase()))
      .sort((a, b) => collator.compare(a.name, b.name));
    members.push({ name: folder.name, count: files.length });
    for (const file of files) {
      const relative = `assets/${folder.name}/${file.name}`;
      const info = await stat(path.join(root, relative));
      const stem = path.parse(file.name).name;
      const parts = stem.split('__');
      images.push({
        id: relative, owner: folder.name, name: parts.length === 3 ? parts[1] : stem,
        sequence: parts.length === 3 ? parts[2] : '', filename: file.name,
        path: relative, url: '/' + relative.split('/').map(encodeURIComponent).join('/'),
        format: path.extname(file.name).slice(1).toUpperCase(), bytes: info.size,
      });
    }
  }
  return { members, images };
}

const cell = value => value.replaceAll('|', '\\|').replaceAll('\n', ' ');
function table(images, prefix) {
  return ['| 归属 | 图片名称 | 序号 | 文件路径 |', '| --- | --- | --- | --- |',
    ...images.map(item => `| ${cell(item.owner)} | ${cell(item.name)} | ${item.sequence} | [${cell(item.filename)}](${prefix}${item.path.split('/').map(encodeURIComponent).join('/')}) |`)].join('\n');
}

export async function writeCatalogs() {
  const catalog = await scanAssets();
  await mkdir(path.join(root, 'catalog'), { recursive: true });
  await writeFile(path.join(root, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
  await writeFile(path.join(root, 'CATALOG.md'), `# 图片资产总册\n\n由图片目录自动生成，请勿手工修改。执行 \`npm run catalog\` 更新；启动服务也会更新。\n\n共 ${catalog.members.length} 个成员，${catalog.images.length} 张图片。\n\n## 成员分册\n\n${catalog.members.map(member => `- [${member.name}](catalog/${encodeURIComponent(member.name)}.md)：${member.count} 张`).join('\n')}\n\n## 全部图片\n\n${table(catalog.images, '')}\n`);
  for (const member of catalog.members) {
    await writeFile(path.join(root, 'catalog', `${member.name}.md`), `# ${member.name} 的图片分册\n\n[返回总册](../CATALOG.md) · 共 ${member.count} 张图片\n\n由图片目录自动生成，请勿手工修改。\n\n${table(catalog.images.filter(item => item.owner === member.name), '../')}\n`);
  }
  return catalog;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const catalog = await writeCatalogs();
  console.log(`总册已更新：${catalog.members.length} 个成员，${catalog.images.length} 张图片。`);
}
