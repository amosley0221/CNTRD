// Generates the PWA install icons from scratch — no image library, just
// vanilla Node + zlib. We need these as real PNG files (not SVG) because
// Android Chrome only treats a manifest as installable WebAPK when it
// has at least one PNG icon at 192×192 or 512×512. SVG icons make
// "Add to Home Screen" produce a plain shortcut that opens in a Chrome
// tab, which is why notifications still showed the URL.
//
// Run once with `node scripts/make-icons.js`. Output is committed to
// public/icons so the runtime never has to render anything.
//
// Design: dark stadium background with a chunky white "C" — same colors
// as the SVG icon (#0A0A0B + #F4F1EA), drawn pixel-by-pixel as a thick
// ring with a wedge cut out on the right side.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BG = [0x0A, 0x0A, 0x0B];   // matches --cn-bg
const FG = [0xF4, 0xF1, 0xEA];   // matches --cn-text

function makeIcon(size) {
  const w = size, h = size;
  // Pixel buffer in raw RGB. Each row prefixed with a filter byte
  // (0 = None) per the PNG spec.
  const stride = w * 3;
  const raw = Buffer.alloc(h * (1 + stride));
  for (let y = 0; y < h; y++) raw[y * (1 + stride)] = 0;   // filter byte

  const cx = w / 2 - 0.5;
  const cy = h / 2 - 0.5;
  // Outer + inner radii of the ring, plus a wedge cut to make the C.
  const outer = w * 0.36;
  const inner = w * 0.24;
  const wedgeHalfDeg = 38;      // opening on the right side
  const corner = w * 0.18;      // squircle-ish background corner radius

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Rounded background: clip the four corners.
      const dx = Math.max(corner - x, x - (w - 1 - corner), 0);
      const dy = Math.max(corner - y, y - (h - 1 - corner), 0);
      const cornerDist = Math.sqrt(dx * dx + dy * dy);
      const inBackground = cornerDist <= corner;

      let r = BG[0], g = BG[1], b = BG[2];
      if (!inBackground) {
        // Transparent corners would need RGBA; instead just keep the
        // pixel pure black so the launcher's mask handles it cleanly.
        r = g = b = 0;
      }

      // The C: distance from center, plus a wedge to cut the right side.
      const ddx = x - cx;
      const ddy = y - cy;
      const dist = Math.sqrt(ddx * ddx + ddy * ddy);
      if (dist >= inner && dist <= outer) {
        // angle in degrees, 0 = right, 90 = down, ranges -180..180
        const angle = Math.atan2(ddy, ddx) * 180 / Math.PI;
        // wedge open on the right (around angle 0)
        if (Math.abs(angle) > wedgeHalfDeg) {
          r = FG[0]; g = FG[1]; b = FG[2];
        }
      }

      const off = y * (1 + stride) + 1 + x * 3;
      raw[off] = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
    }
  }

  // PNG file = signature + IHDR + IDAT + IEND.
  const sig  = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8]  = 8;   // bit depth
  ihdr[9]  = 2;   // color type: RGB
  ihdr[10] = 0;   // compression
  ihdr[11] = 0;   // filter
  ihdr[12] = 0;   // interlace
  const idat = zlib.deflateSync(raw);

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = (CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)) >>> 0;
  return (c ^ 0xffffffff) >>> 0;
}

const outDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
for (const size of [192, 512, 180]) {
  const png = makeIcon(size);
  const file = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(file, png);
  console.log(`wrote ${file} (${png.length} bytes)`);
}
