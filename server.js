import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import selfsigned from 'selfsigned';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HTTP_PORT = process.env.HTTP_PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3001;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function requestHandler(req, res) {
  let parsedUrl = req.url.split('?')[0];
  if (parsedUrl === '/') parsedUrl = '/index.html';

  let filePath = path.join(__dirname, parsedUrl);

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      if (fs.existsSync(filePath + '.html')) {
        filePath = filePath + '.html';
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
        return;
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

// 1. HTTP Server (Port 3000 - perfect for desktop & ADB reverse on Quest)
const httpServer = http.createServer(requestHandler);
httpServer.listen(HTTP_PORT, () => {
  console.log(`[HTTP] Tiny World running at: http://localhost:${HTTP_PORT}`);
});

// 2. HTTPS Server (Port 3001 - required by Meta Quest 3 over Wi-Fi)
function getLocalIp() {
  const ifaces = os.networkInterfaces();
  for (const name in ifaces) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const localIp = getLocalIp();

// Generate or load self-signed certificate for WebXR over HTTPS
let certAttrs = [{ name: 'commonName', value: localIp }];
const pems = selfsigned.generate(certAttrs, { days: 365 });

const httpsOptions = {
  key: pems.private,
  cert: pems.cert
};

const httpsServer = https.createServer(httpsOptions, requestHandler);
httpsServer.listen(HTTPS_PORT, () => {
  console.log(`[HTTPS] Tiny World running at: https://localhost:${HTTPS_PORT}`);
  console.log(`[Quest 3 Wi-Fi] Open Meta Quest Browser to: https://${localIp}:${HTTPS_PORT}`);
});
