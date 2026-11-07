/**
 * LensLingo - Local Development Server
 * Menjalankan frontend statis (public/) dan handler serverless (api/identify.js)
 * di komputer lokal tanpa perlu Vercel CLI.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const identifyHandler = require('./api/identify.js');
const aslHandler = require('./api/asl.js');

// Baca file .env lokal jika ada (tanpa library dotenv)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
}

// Jika belum ada GEMINI_API_KEY saat testing lokal, aktifkan MOCK_MODE agar tetap bisa dicoba
if (!process.env.GEMINI_API_KEY && !process.env.MOCK_MODE) {
  process.env.MOCK_MODE = 'true';
  console.log('[INFO] GEMINI_API_KEY belum disetel. MOCK_MODE diaktifkan otomatis untuk pengujian lokal.');
}

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  // 1. Tangani endpoint API /api/identify
  if (req.url === '/api/identify' || req.url.startsWith('/api/identify?')) {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json', Allow: 'POST' });
      return res.end(JSON.stringify({ error: 'Hanya menerima request POST' }));
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload terlalu besar' }));
        req.destroy();
      }
    });

    req.on('end', async () => {
      try {
        console.log(`[DEV-SERVER] 📸 Menerima foto untuk diidentifikasi (${Math.round(body.length / 1024)} KB)...`);
        const parsedBody = body ? JSON.parse(body) : {};
        const mockReq = { method: req.method, body: parsedBody, headers: req.headers };

        const mockRes = {
          _status: 200,
          _headers: {},
          setHeader(name, val) {
            this._headers[name] = val;
          },
          status(code) {
            this._status = code;
            return this;
          },
          json(data) {
            if (this._status === 200) {
              console.log(`[DEV-SERVER] ✅ Berhasil mengenali: "${data.word}" (${data.indonesian || '-'})`);
            } else {
              console.log(`[DEV-SERVER] ❌ Gagal (${this._status}):`, data.error || 'Unknown error');
            }
            res.writeHead(this._status, {
              'Content-Type': 'application/json',
              ...this._headers
            });
            res.end(JSON.stringify(data));
          }
        };

        await identifyHandler(mockReq, mockRes);
      } catch (err) {
        console.error('[DEV-SERVER] ❌ Error:', err.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Format JSON body tidak valid' }));
      }
    });
    return;
  }

  // 2. Tangani endpoint API /api/asl
  if (req.url === '/api/asl' || req.url.startsWith('/api/asl?')) {
    const parsedUrl = new URL(req.url, 'http://localhost');
    const query = Object.fromEntries(parsedUrl.searchParams.entries());
    const mockReq = { method: req.method, url: req.url, query, headers: req.headers };

    const mockRes = {
      _status: 200,
      _headers: {},
      setHeader(name, val) {
        this._headers[name] = val;
      },
      status(code) {
        this._status = code;
        return this;
      },
      json(data) {
        if (this._status === 200) {
          console.log(`[DEV-SERVER] 🤟 ASL: Ditemukan ${data.videos?.length || 0} video untuk "${data.word}"`);
        } else {
          console.log(`[DEV-SERVER] ❌ ASL Gagal (${this._status}):`, data.error || 'Unknown error');
        }
        res.writeHead(this._status, {
          'Content-Type': 'application/json',
          ...this._headers
        });
        res.end(JSON.stringify(data));
      }
    };

    aslHandler(mockReq, mockRes).catch((err) => {
      console.error('[DEV-SERVER] ❌ ASL Error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Terjadi kesalahan server lokal' }));
    });
    return;
  }

  // 3. Tangani file statis dari public/
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const safePath = path.normalize(reqPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`  LensLingo Dev Server aktif!`);
  console.log(`  Buka di browser: http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});
