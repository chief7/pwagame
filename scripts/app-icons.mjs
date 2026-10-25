// Write the app icons in public/ from the appIcon() sprite.
//
//   npm run icons
//
// Each sprite pixel becomes a solid square, so the icons stay crisp.

import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { appIcon } = await vite.ssrLoadModule('/src/sprites/ui.ts');
await vite.close();

const icon = appIcon();
// Maskable icons are cropped to a circle of 80% width: more sea keeps the scene inside it.
const maskable = appIcon(40);

function rgbOf(icon) {
  return icon.pixels.map((c) => {
    if (!c?.startsWith('#') || c.length !== 7) throw new Error(`app icon needs opaque #rrggbb pixels, got ${c}`);
    return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  });
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

/** PNG of `size` px: the icon at a whole-number scale, centred on a border of its edge colour. */
function png(icon, size) {
  const pixels = rgbOf(icon);
  const scale = Math.floor(size / icon.width);
  const pad = Math.floor((size - icon.width * scale) / 2);
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    for (let x = 0; x < size; x++) {
      const sx = Math.min(icon.width - 1, Math.max(0, Math.floor((x - pad) / scale)));
      const sy = Math.min(icon.height - 1, Math.max(0, Math.floor((y - pad) / scale)));
      Buffer.from(pixels[sy * icon.width + sx]).copy(raw, row + 1 + x * 3);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** SVG with one rect per horizontal run of same-coloured pixels. */
function svg() {
  rgbOf(icon);
  const rects = [];
  for (let y = 0; y < icon.height; y++) {
    for (let x = 0; x < icon.width; ) {
      const c = icon.pixels[y * icon.width + x];
      let w = 1;
      while (x + w < icon.width && icon.pixels[y * icon.width + x + w] === c) w++;
      rects.push(`<rect x="${x}" y="${y}" width="${w}" height="1" fill="${c}"/>`);
      x += w;
    }
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${icon.width} ${icon.height}" shape-rendering="crispEdges">`,
    ...rects.map((r) => `  ${r}`),
    '</svg>',
    '',
  ].join('\n');
}

writeFileSync('public/icon.svg', svg());
writeFileSync('public/icon-192.png', png(icon, 192));
writeFileSync('public/icon-512.png', png(icon, 512));
writeFileSync('public/icon-maskable-512.png', png(maskable, 512));
writeFileSync('public/apple-touch-icon.png', png(maskable, 180));
console.log('wrote public/icon.svg, icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png');
