import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, 'dist');
const port = parseInt(process.env.PORT || '3000', 10);

// Auto-build fallback if dist/ does not exist yet
if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.log('⚡ dist/index.html not found, executing vite build on startup...');
  try {
    execSync('npx vite build', { stdio: 'inherit', cwd: __dirname });
  } catch (err) {
    console.error('Startup build failed:', err.message);
  }
}

const mimeTypes = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp'
};

const BACKEND_URL = (process.env.BACKEND_URL || process.env.VITE_API_URL || 'https://wanderloop.onrender.com').replace(/\/+$/, '');

const server = http.createServer(async (req, res) => {
  // CORS & Security headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const cleanUrl = (req.url || '/').split('?')[0];

  if (cleanUrl === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'wanderloop-frontend' }));
    return;
  }

  // Reverse proxy /api requests to backend
  if (cleanUrl.startsWith('/api')) {
    try {
      const targetUrl = `${BACKEND_URL}${req.url}`;
      const forwardHeaders = { ...req.headers };
      delete forwardHeaders.host;
      delete forwardHeaders['accept-encoding'];

      const bodyChunks = [];
      for await (const chunk of req) {
        bodyChunks.push(chunk);
      }
      const hasBody = !['GET', 'HEAD'].includes(req.method?.toUpperCase());
      const body = hasBody && bodyChunks.length > 0 ? Buffer.concat(bodyChunks) : undefined;

      const upstreamRes = await fetch(targetUrl, {
        method: req.method,
        headers: forwardHeaders,
        body
      });

      const resBuffer = Buffer.from(await upstreamRes.arrayBuffer());

      const responseHeaders = {};
      upstreamRes.headers.forEach((val, key) => {
        const lowerKey = key.toLowerCase();
        // Remove hop-by-hop and compression headers since resBuffer is already decompressed
        if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(lowerKey)) {
          responseHeaders[key] = val;
        }
      });

      // Forward Set-Cookie properly
      if (typeof upstreamRes.headers.getSetCookie === 'function') {
        const cookies = upstreamRes.headers.getSetCookie();
        if (cookies && cookies.length > 0) {
          responseHeaders['set-cookie'] = cookies;
        }
      }

      // Explicitly set the actual uncompressed buffer length
      responseHeaders['content-length'] = resBuffer.length;

      res.writeHead(upstreamRes.status, responseHeaders);
      res.end(resBuffer);
      return;
    } catch (proxyErr) {
      console.error('[server]: Proxy error to backend:', proxyErr.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Backend gateway error', details: proxyErr.message }));
      return;
    }
  }

  let safePath = path.normalize(cleanUrl).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(distDir, safePath === '/' ? 'index.html' : safePath);

  // If file doesn't exist or is a directory, fallback to index.html (SPA routing)
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('500 Internal Server Error');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`⚡ Wanderloop static server running on http://0.0.0.0:${port}`);
});
