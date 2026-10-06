import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv.includes('--dist') ? 'dist' : '.');
const port = Number(process.env.PORT || 5173);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp', '.png':'image/png', '.md':'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.otf':'font/otf', '.ttf':'font/ttf', '.mp4':'video/mp4', '.txt':'text/plain; charset=utf-8' };
http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    const relative = path.relative(root, file);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !/^(index\.html|styles\.css|app\.js|content\.js|project-details\.js|glass\.js|fonts[/\\]SF-Pro-Display-(?:Regular|Medium)\.otf|assets[/\\](?:fonts[/\\])?[\w.-]+)$/.test(relative)) {
      response.writeHead(404); response.end('Not found'); return;
    }
    const body = await readFile(file);
    const headers = { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control':'no-cache', 'Accept-Ranges':'bytes' };
    const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Math.min(range[2] ? Number(range[2]) : body.length-1, body.length-1);
      if (start > end || start >= body.length) { response.writeHead(416, { 'Content-Range':`bytes */${body.length}` }); response.end(); return; }
      response.writeHead(206, { ...headers, 'Content-Length':end-start+1, 'Content-Range':`bytes ${start}-${end}/${body.length}` });
      response.end(request.method === 'HEAD' ? undefined : body.subarray(start,end+1));
    } else {
      response.writeHead(200, { ...headers, 'Content-Length':body.length });
      response.end(request.method === 'HEAD' ? undefined : body);
    }
  } catch {
    response.writeHead(404); response.end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Portfolio: http://localhost:${port}`));
