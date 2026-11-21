/* Winziger lokaler Webserver – ohne Pakete, nur Node.
   Startet die Jura-Kartei unter http://localhost:<port>/ */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');

const WURZEL = __dirname;
const TYPEN = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.md':   'text/markdown; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const datei = path.join(WURZEL, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
  if (!datei.startsWith(WURZEL)) { res.writeHead(403).end('Verboten'); return; }
  fs.readFile(datei, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Nicht gefunden'); return; }
    res.writeHead(200, {
      'Content-Type': TYPEN[path.extname(datei).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Service-Worker-Allowed': '/',
    });
    res.end(data);
  });
});

function lanIp() {
  for (const liste of Object.values(os.networkInterfaces()))
    for (const i of liste || [])
      if (i.family === 'IPv4' && !i.internal) return i.address;
  return null;
}

let port = Number(process.env.PORT) || 7345;
server.on('error', e => {
  if (e.code === 'EADDRINUSE' && port < 7360) { port++; server.listen(port, '0.0.0.0'); }
  else { console.error('Fehler:', e.message); process.exit(1); }
});
server.listen(port, '0.0.0.0', () => {
  const ip = lanIp();
  console.log('');
  console.log('  Jura-Kartei läuft.');
  console.log('  ------------------------------------------------');
  console.log('  Auf diesem Mac:   http://localhost:' + port + '/');
  if (ip) console.log('  Im selben WLAN:   http://' + ip + ':' + port + '/');
  console.log('');
  console.log('  Zum Beenden: dieses Fenster schließen oder Strg+C.');
  console.log('');
});
