// Rebuild raster PWA assets from the editable SVG. Requires npm ci (sharp).
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

(async () => {
  const directory = path.resolve(__dirname, '../frontend/assets');
  const svg = await fs.readFile(path.join(directory, 'favicon.svg'), 'utf8');
  for (const size of [180, 192, 512]) {
    const icon = sharp(Buffer.from(svg)).resize(size, size);
    if (size === 180) icon.flatten({background:'#1947B8'}); // iOS applies its own corner mask.
    await icon.png().toFile(path.join(directory, `icon-${size}.png`));
  }
  // Separate maskable artwork: full-bleed background, symbol inside the safe circle.
  const symbol = svg.slice(svg.indexOf('  <path'), svg.lastIndexOf('</svg>'));
  const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#1947B8"/><g transform="translate(38.4 38.4) scale(.85)">${symbol}</g></svg>`;
  await fs.writeFile(path.join(directory, 'icon-maskable.svg'), maskable);
  await sharp(Buffer.from(maskable)).resize(512, 512).png().toFile(path.join(directory, 'icon-maskable-512.png'));
  console.log('Ícones gerados: 180, 192, 512 e versão maskable 512.');
})().catch(error => { console.error(error); process.exitCode = 1; });
