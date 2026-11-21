// 의존성 없는 정적 파일 서버: `npm start` → http://localhost:8080
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 8080;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.normalize(path.join(root, urlPath === '/' ? 'index.html' : urlPath));
  if (!file.startsWith(root + path.sep) || file.includes(`${path.sep}.`)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// 포트가 이미 쓰이고 있으면(예: 예전 게임 서버 창이 켜져 있음) 다음 번호로 (최대 10번)
let tryPort = port;
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && tryPort < port + 10) {
    console.log(`Port ${tryPort} is already in use (another game server window may be open). Trying ${tryPort + 1}...`);
    tryPort++;
    setTimeout(() => server.listen(tryPort), 100);
  } else {
    console.error(err.message);
    process.exit(1);
  }
});
server.on('listening', () => {
  const url = `http://localhost:${tryPort}`;
  console.log(`Game server: ${url}  (close this window to stop)`);
  if (tryPort !== port) console.log(`NOTE: characters are saved per address. Characters made on http://localhost:${port} appear only there.`);
  // START-WINDOWS.bat 에서 실행하면 실제로 열린 주소로 브라우저를 엶
  if (process.env.OPEN_BROWSER) {
    const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
    exec(cmd, () => {});
  }
});
server.listen(tryPort);
