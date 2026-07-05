/**
 * Generiert alle benötigten App-Assets für Wort des Tages.
 * Ausführen mit: node generate-assets.js
 */
const zlib = require('zlib');
const fs = require('fs');

const BG     = [0x17, 0x13, 0x10]; // #171310 dunkel
const ORANGE = [0xE8, 0x83, 0x54]; // #E88354 akzent
const WHITE  = [0xFF, 0xFF, 0xFF];

// ── PNG-Encoder (ohne externe Abhängigkeiten) ─────────────────────────────────

function encodePNG(w, h, data /* Uint8Array RGBA */) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA

  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: None
    for (let x = 0; x < w; x++) {
      const src = (y * w + x) * 4;
      const dst = y * (w * 4 + 1) + 1 + x * 4;
      raw[dst]   = data[src];
      raw[dst+1] = data[src+1];
      raw[dst+2] = data[src+2];
      raw[dst+3] = data[src+3];
    }
  }

  const comp = zlib.deflateSync(raw, { level: 6 });

  // CRC32
  const tbl = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    tbl[i] = c;
  }
  function crc(buf) {
    let c = 0xFFFFFFFF;
    for (const b of buf) c = tbl[(c ^ b) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function chunk(type, body) {
    const l = Buffer.alloc(4); l.writeUInt32BE(body.length);
    const t = Buffer.from(type, 'ascii');
    const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(Buffer.concat([t, body])));
    return Buffer.concat([l, t, body, cc]);
  }

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', comp), chunk('IEND', Buffer.alloc(0))]);
}

// ── Zeichenprimitive ──────────────────────────────────────────────────────────

function makeCanvas(w, h, bgColor, bgAlpha = 255) {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i*4]   = bgColor[0];
    data[i*4+1] = bgColor[1];
    data[i*4+2] = bgColor[2];
    data[i*4+3] = bgAlpha;
  }

  function setPixel(x, y, [r, g, b], a = 255) {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const i = (y * w + x) * 4;
    if (a === 255) {
      data[i]=r; data[i+1]=g; data[i+2]=b; data[i+3]=255;
    } else {
      const fa = a / 255;
      data[i]   = Math.round(data[i]   * (1-fa) + r * fa);
      data[i+1] = Math.round(data[i+1] * (1-fa) + g * fa);
      data[i+2] = Math.round(data[i+2] * (1-fa) + b * fa);
      data[i+3] = Math.min(255, data[i+3] + a);
    }
  }

  // Gefülltes Rechteck
  function fillRect(x, y, rw, rh, color, alpha) {
    for (let py = Math.max(0, y); py < Math.min(h, y + rh); py++)
      for (let px = Math.max(0, x); px < Math.min(w, x + rw); px++)
        setPixel(px, py, color, alpha);
  }

  // Gefülltes abgerundetes Rechteck (korrekte Kreissegmente in den Ecken)
  function fillRoundRect(x, y, rw, rh, radius, color) {
    const r = Math.min(radius, rw / 2, rh / 2);
    for (let py = y; py < y + rh; py++) {
      for (let px = x; px < x + rw; px++) {
        const dx = Math.max(0, Math.max(x + r - px, px - (x + rw - r)));
        const dy = Math.max(0, Math.max(y + r - py, py - (y + rh - r)));
        if (dx * dx + dy * dy <= r * r) setPixel(px, py, color);
      }
    }
  }

  // Dicke Linie mit Anti-Aliasing-Näherung
  function fillLine(x1, y1, x2, y2, thickness, color) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx*dx + dy*dy);
    if (len === 0) return;
    const nx = -dy / len, ny = dx / len; // Normalvektor
    const t = thickness / 2;
    const steps = Math.ceil(len * 1.5);
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const mx = x1 + dx * f, my = y1 + dy * f;
      for (let s = -t; s <= t; s += 0.5) {
        const alpha = Math.max(0, 255 - Math.max(0, Math.abs(s) - (t - 1)) * 255);
        setPixel(Math.round(mx + nx * s), Math.round(my + ny * s), color, alpha);
      }
    }
  }

  return { data, setPixel, fillRect, fillRoundRect, fillLine, w, h };
}

// ── Icon-Design: "W" auf orangem Hintergrund ──────────────────────────────────

function drawAppIcon(c) {
  const { w, h, fillRoundRect, fillLine } = c;
  const pad = w * 0.07;
  const radius = w * 0.22;

  // Oranger Hintergrund (abgerundetes Quadrat)
  fillRoundRect(pad, pad, w - 2*pad, h - 2*pad, radius, ORANGE);

  // "W" – 4 Linien
  const thick = w * 0.095;
  const top  = h * 0.21;
  const bot  = h * 0.79;
  const midY = h * 0.56;
  const x1 = w * 0.16, x2 = w * 0.36, x3 = w * 0.50, x4 = w * 0.64, x5 = w * 0.84;

  fillLine(x1, top, x2, bot,  thick, BG);
  fillLine(x2, bot, x3, midY, thick, BG);
  fillLine(x3, midY, x4, bot, thick, BG);
  fillLine(x4, bot, x5, top,  thick, BG);
}

// Adaptive Icon: nur das W, kein Außenrand (Android schneidet selbst aus)
function drawAdaptiveIcon(c) {
  const { w, h, fillRoundRect, fillLine } = c;
  // Vollflächig orange
  fillRoundRect(0, 0, w, h, 0, ORANGE);

  const thick = w * 0.095;
  const top  = h * 0.18;
  const bot  = h * 0.82;
  const midY = h * 0.54;
  const x1 = w * 0.13, x2 = w * 0.34, x3 = w * 0.50, x4 = w * 0.66, x5 = w * 0.87;

  fillLine(x1, top, x2, bot,  thick, BG);
  fillLine(x2, bot, x3, midY, thick, BG);
  fillLine(x3, midY, x4, bot, thick, BG);
  fillLine(x4, bot, x5, top,  thick, BG);
}

// Splash Icon: mittig kleines Icon auf dunklem Hintergrund
function drawSplashIcon(c) {
  const { w, h, fillRoundRect, fillLine } = c;
  const s = w * 0.55; // Icon-Größe
  const ox = (w - s) / 2, oy = (h - s) / 2;
  const radius = s * 0.22;

  fillRoundRect(ox, oy, s, s, radius, ORANGE);

  const thick = s * 0.095;
  const top  = oy + s * 0.21;
  const bot  = oy + s * 0.79;
  const midY = oy + s * 0.56;
  const x1 = ox + s*0.16, x2 = ox + s*0.36, x3 = ox + s*0.50;
  const x4 = ox + s*0.64, x5 = ox + s*0.84;

  fillLine(x1, top, x2, bot,  thick, BG);
  fillLine(x2, bot, x3, midY, thick, BG);
  fillLine(x3, midY, x4, bot, thick, BG);
  fillLine(x4, bot, x5, top,  thick, BG);
}

// Notification Icon: weißes "W" auf transparentem Hintergrund (monochrom)
function drawNotificationIcon(c) {
  const { w, h, fillLine } = c;
  const thick = w * 0.11;
  const top  = h * 0.12;
  const bot  = h * 0.88;
  const midY = h * 0.56;
  const x1 = w * 0.08, x2 = w * 0.31, x3 = w * 0.50, x4 = w * 0.69, x5 = w * 0.92;

  fillLine(x1, top, x2, bot,  thick, WHITE);
  fillLine(x2, bot, x3, midY, thick, WHITE);
  fillLine(x3, midY, x4, bot, thick, WHITE);
  fillLine(x4, bot, x5, top,  thick, WHITE);
}

// ── Generieren ────────────────────────────────────────────────────────────────

fs.mkdirSync('assets', { recursive: true });

const tasks = [
  { file: 'assets/icon.png',              size: 1024, fn: drawAppIcon,          bg: BG,    bgA: 255 },
  { file: 'assets/adaptive-icon.png',     size: 1024, fn: drawAdaptiveIcon,     bg: ORANGE, bgA: 255 },
  { file: 'assets/splash-icon.png',       size: 1024, fn: drawSplashIcon,       bg: BG,    bgA: 255 },
  { file: 'assets/notification-icon.png', size: 96,   fn: drawNotificationIcon, bg: BG,    bgA: 0   },
];

for (const { file, size, fn, bg, bgA } of tasks) {
  process.stdout.write(`Generating ${file} ...`);
  const c = makeCanvas(size, size, bg, bgA);
  fn(c);
  fs.writeFileSync(file, encodePNG(size, size, c.data));
  console.log(' ✓');
}

console.log('\nAlle Assets wurden in assets/ erstellt.');
