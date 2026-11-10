// Generates the PWA icons as PNG without external dependencies.
// Run with: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const BG = [0x12, 0x14, 0x17];
const ACCENT = [0x34, 0xd3, 0x99];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size, pixels) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    pixels.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Draws a dumbbell; `scale` shrinks it to fit the maskable safe zone.
function draw(size, scale) {
  const px = Buffer.alloc(size * size * 3);
  for (let i = 0; i < size * size; i++) px.set(BG, i * 3);
  const u = (size / 100) * scale;
  const c = size / 2;
  const rect = (x0, y0, x1, y1, r) => {
    for (let y = Math.round(c + y0 * u); y < Math.round(c + y1 * u); y++)
      for (let x = Math.round(c + x0 * u); x < Math.round(c + x1 * u); x++) {
        // rounded corners
        const ax = Math.min(x - (c + x0 * u), c + x1 * u - x);
        const ay = Math.min(y - (c + y0 * u), c + y1 * u - y);
        const rr = r * u;
        if (ax < rr && ay < rr && (rr - ax) ** 2 + (rr - ay) ** 2 > rr * rr) continue;
        if (x >= 0 && y >= 0 && x < size && y < size) px.set(ACCENT, (y * size + x) * 3);
      }
  };
  rect(-30, -4, 30, 4, 1);      // bar
  rect(-30, -22, -20, 22, 3);   // inner plates
  rect(20, -22, 30, 22, 3);
  rect(-40, -14, -31, 14, 3);   // outer plates
  rect(31, -14, 40, 14, 3);
  return png(size, px);
}

writeFileSync('public/icons/icon-192.png', draw(192, 1));
writeFileSync('public/icons/icon-512.png', draw(512, 1));
writeFileSync('public/icons/maskable-512.png', draw(512, 0.75));
writeFileSync('public/icons/apple-touch-icon.png', draw(180, 0.85));
console.log('icons written');
