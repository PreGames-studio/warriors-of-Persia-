const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;
const CS_SCRIPT_PATH = path.join(__dirname, '..', 'unity_3d', 'Assets', 'Scripts', 'World', 'PersianWorldMapBuilder.cs');
const APP_ZIP_PATH = path.join(__dirname, '..', 'WarriorsOfPersia_3D_Final_Build.zip');
const STANDALONE_HTML_PATH = path.join(__dirname, 'WarriorsOfPersia_3D_Standalone.html');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ttf': 'font/ttf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.obj': 'text/plain; charset=utf-8',
  '.zip': 'application/zip'
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const urlPath = req.url.split('?')[0];

  if (urlPath === '/csharp-map-builder') {
    fs.readFile(CS_SCRIPT_PATH, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('// File not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  if (urlPath === '/download-app-zip') {
    fs.readFile(APP_ZIP_PATH, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('App package not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="WarriorsOfPersia_3D_Final_Build.zip"'
      });
      res.end(data);
    });
    return;
  }

  if (urlPath === '/download-standalone-html') {
    fs.readFile(STANDALONE_HTML_PATH, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Standalone HTML not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': 'attachment; filename="WarriorsOfPersia_3D_Standalone.html"'
      });
      res.end(data);
    });
    return;
  }

  let safePath = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '') {
    safePath = '/index.html';
  }

  const filePath = path.join(PUBLIC_DIR, safePath);
  const ext = path.extname(filePath).toLowerCase();

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Warriors of Persia 3D App running on http://0.0.0.0:${PORT}`);
});
