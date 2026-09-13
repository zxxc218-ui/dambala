/**
 * Draws the app icon at the sizes an installed app needs.
 *
 *   node scripts/gen-icons.mjs
 *
 * The mark is a drawn ball, because that is the thing the app is: a white
 * sphere with the emerald the rest of the app uses, on the same near-black the
 * pages sit on. No text — a word at 48 pixels is a smudge, and the icon has to
 * survive being one of thirty on a phone's home screen.
 *
 * Two shapes are produced. The plain one keeps a margin of its own, because
 * desktop and older phones paint it as-is. The maskable one is full-bleed with
 * the ball inside the middle 60%, because Android crops maskable icons to
 * whatever shape the launcher likes and anything near the edge is lost.
 */

import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const OUT = new URL('../public/icons/', import.meta.url);

const BG = '#0b1120';
const RING = '#10b981';

/**
 * @param size    pixel size of the square
 * @param ball    diameter of the ball as a fraction of the square
 * @param rounded corner radius as a fraction (0 = full bleed, for maskable)
 */
function icon(size, ball, rounded) {
  const c = size / 2;
  const r = (size * ball) / 2;
  const radius = size * rounded;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="sphere" cx="34%" cy="28%" r="78%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="45%" stop-color="#e8edf4"/>
      <stop offset="100%" stop-color="#94a3b8"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${RING}" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="${RING}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="${BG}"/>
  <circle cx="${c}" cy="${c}" r="${r * 1.55}" fill="url(#glow)"/>

  <circle cx="${c}" cy="${c}" r="${r}" fill="url(#sphere)"/>
  <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${RING}" stroke-width="${size * 0.035}"/>
  <circle cx="${c}" cy="${c}" r="${r * 0.62}" fill="none" stroke="${RING}" stroke-width="${size * 0.022}" stroke-opacity="0.55"/>

  <!-- the three marks of a row, the one thing that says tambola rather than golf -->
  <g fill="${BG}">
    <circle cx="${c - r * 0.3}" cy="${c}" r="${r * 0.085}"/>
    <circle cx="${c}" cy="${c}" r="${r * 0.085}"/>
    <circle cx="${c + r * 0.3}" cy="${c}" r="${r * 0.085}"/>
  </g>

  <!-- the light on top, so it reads as a sphere and not a coin -->
  <ellipse cx="${c - r * 0.32}" cy="${c - r * 0.42}" rx="${r * 0.26}" ry="${r * 0.17}"
           fill="#ffffff" fill-opacity="0.75" transform="rotate(-28 ${c - r * 0.32} ${c - r * 0.42})"/>
</svg>`;
}

async function write(name, svg, size) {
  const file = new URL(name, OUT);
  await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(file.pathname);
  console.log('wrote', name);
}

await mkdir(OUT, { recursive: true });

// plain: keeps its own breathing room and its own rounded corners
await write('icon-192.png', icon(192, 0.66, 0.22), 192);
await write('icon-512.png', icon(512, 0.66, 0.22), 512);
await write('apple-touch-icon.png', icon(180, 0.72, 0.0), 180); // iOS rounds it itself

// maskable: full bleed, ball well inside the safe circle
await write('maskable-192.png', icon(192, 0.5, 0), 192);
await write('maskable-512.png', icon(512, 0.5, 0), 512);

// the browser tab
await write('favicon-32.png', icon(32, 0.78, 0.18), 32);
