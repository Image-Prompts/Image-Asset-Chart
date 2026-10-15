import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { root, extensions, writeCatalogs } from './scripts/catalog.mjs';

const port = Number(process.env.PORT || 3000);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.md': 'text/plain; charset=utf-8', '.json': 'application/json; charset=utf-8' };
// Serialize refreshes so concurrent requests cannot interleave catalog writes.
let refresh = Promise.resolve();
function catalog() { refresh = refresh.catch(() => {}).then(writeCatalogs); return refresh; }
await catalog();
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/api/catalog') {
      const data = await catalog();
      res.writeHead(200, { 'Content-Type': types['.json'], 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify(data));
    }
    const publicFiles = { '/': 'web/index.html', '/app.js': 'web/app.js', '/styles.css': 'web/styles.css', '/CATALOG.md': 'CATALOG.md', '/catalog.json': 'catalog.json', '/README.md': 'README.md' };
    let relative = publicFiles[pathname];
    if (!relative && pathname.startsWith('/assets/') && extensions.has(path.extname(pathname).toLowerCase())) relative = pathname.slice(1);
    const target = relative && path.resolve(root, relative);
    if (!target || !target.startsWith(path.resolve(root) + path.sep)) {
      res.writeHead(404); return res.end('Not found');
    }
    const content = await readFile(target);
    res.writeHead(200, { 'Content-Type': types[path.extname(target).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(content);
  } catch (error) {
    res.writeHead(error.code === 'ENOENT' ? 404 : 500);
    res.end(error.code === 'ENOENT' ? 'Not found' : '无法读取图片库，请查看终端。');
    if (error.code !== 'ENOENT') console.error(error);
  }
});
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `端口 ${port} 已被占用。请关闭旧服务或设置 PORT 后重试。` : error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`图片资产库已启动：http://localhost:${port}\n按 Ctrl+C 停止；新增图片后点击页面“刷新图片”。`));
