/* Erzeugt die App-Symbole als PNG – ohne externe Pakete. */
const zlib = require('zlib'), fs = require('fs'), path = require('path');

function png(width, height, pixels) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    pixels.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

let T = null;
function crc32(buf) {
  if (!T) {
    T = new Int32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; T[n] = c; }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = T[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function zeichne(size) {
  const px = Buffer.alloc(size * size * 3);
  const BG = hex('#7a1f2b'), KARTE = hex('#f7f5f1'), KARTE2 = hex('#ddd5c9'), LINIE = hex('#b9a9a0');
  const u = size / 100;

  const inRR = (x, y, rx, ry, rw, rh, r) => {
    if (x < rx || y < ry || x >= rx + rw || y >= ry + rh) return false;
    const dx = Math.max(rx + r - x, 0, x - (rx + rw - 1 - r));
    const dy = Math.max(ry + r - y, 0, y - (ry + rh - 1 - r));
    return dx * dx + dy * dy <= r * r;
  };

  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let c = BG;
    if (inRR(x, y, 24 * u, 20 * u, 56 * u, 62 * u, 7 * u)) c = KARTE2;          // hintere Karte
    if (inRR(x, y, 18 * u, 26 * u, 56 * u, 62 * u, 7 * u)) {                    // vordere Karte
      c = KARTE;
      const lx = 27 * u, lw = 38 * u;
      for (const [ly, w] of [[40, 1], [52, 1], [64, 0.72], [76, 0.45]]) {
        if (x >= lx && x < lx + lw * w && y >= ly * u && y < (ly + 4.2) * u) c = LINIE;
      }
      if (x >= 27 * u && x < 27 * u + 4 * u && y >= 36 * u && y < 80 * u) c = hex('#7a1f2b');
    }
    const i = (y * size + x) * 3;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
  }
  return png(size, size, px);
}

const dir = path.join(__dirname, 'icons');
fs.mkdirSync(dir, { recursive: true });
for (const s of [180, 192, 512]) {
  fs.writeFileSync(path.join(dir, `icon-${s}.png`), zeichne(s));
  console.log('icons/icon-' + s + '.png');
}
