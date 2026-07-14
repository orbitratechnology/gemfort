const fs = require('fs');
const https = require('https');
const http = require('http');
const path = require('path');

const BASE = 'https://www.gia.edu';
const outDir = path.join(__dirname, '../assets/images/gems');
fs.mkdirSync(outDir, { recursive: true });

function get(url, binary = false) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(
      url,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: binary ? 'image/*,*/*' : 'text/html,application/xhtml+xml',
          Referer: 'https://www.gia.edu/gem-encyclopedia',
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = res.headers.location.startsWith('http')
            ? res.headers.location
            : BASE + res.headers.location;
          get(next, binary).then(resolve, reject);
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          resolve({
            status: res.statusCode,
            body: binary ? buf : buf.toString('utf8'),
          });
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('timeout ' + url)));
  });
}

const GEMS = [
  { slug: 'ruby', file: 'ruby.png' },
  { slug: 'sapphire', file: 'sapphire.png' },
  { slug: 'emerald', file: 'emerald.png' },
  { slug: 'spinel', file: 'spinel.png' },
  { slug: 'garnet', file: 'garnet.png' },
  { slug: 'tourmaline', file: 'tourmaline.png' },
  { slug: 'diamond', file: 'diamond.png' },
  { slug: 'amethyst', file: 'amethyst.png' },
  { slug: 'aquamarine', file: 'aquamarine.png' },
  { slug: 'opal', file: 'opal.png' },
  { slug: 'peridot', file: 'peridot.png' },
  { slug: 'tanzanite', file: 'tanzanite.png' },
  { slug: 'topaz', file: 'topaz.png' },
  { slug: 'turquoise', file: 'turquoise.png' },
  { slug: 'zircon', file: 'zircon.png' },
  { slug: 'jade', file: 'jade.png' },
  { slug: 'moonstone', file: 'moonstone.png' },
  { slug: 'pearl', file: 'pearl.png' },
  { slug: 'alexandrite', file: 'alexandrite.png' },
  { slug: 'citrine', file: 'citrine.png' },
  { slug: 'morganite', file: 'morganite.png' },
  { slug: 'kunzite', file: 'kunzite.png' },
  { slug: 'iolite', file: 'iolite.png' },
  { slug: 'amber', file: 'amber.png' },
  { slug: 'lapis-lazuli', file: 'lapis-lazuli.png' },
  { slug: 'sunstone', file: 'sunstone.png' },
  { slug: 'rose-quartz', file: 'rose-quartz.png' },
  { slug: 'fancy-color-diamond', file: 'fancy-color-diamond.png' },
  { slug: 'ametrine', file: 'ametrine.png' },
];

function absoluteUrl(src) {
  if (!src) return null;
  if (src.startsWith('http')) return src;
  if (src.startsWith('//')) return 'https:' + src;
  if (src.startsWith('/')) return BASE + src;
  return BASE + '/' + src;
}

function pickImage(html) {
  // Prefer polished hero gem images from GIA encyclopedia pages
  const patterns = [
    /src=["']([^"']*polished[^"']*\.(?:png|jpe?g|webp))["']/gi,
    /src=["']([^"']*\/dam\/[^"']*\.(?:png|jpe?g|webp))["']/gi,
  ];
  for (const re of patterns) {
    const matches = [...html.matchAll(re)].map((m) => m[1]);
    const gem = matches.find(
      (s) =>
        /polished|gemstones/i.test(s) &&
        !/logo|gemkids|icon|favicon|sprite/i.test(s),
    );
    if (gem) return absoluteUrl(gem);
  }
  return null;
}

(async () => {
  const manifest = {};
  for (const gem of GEMS) {
    const pageUrl = `${BASE}/${gem.slug}`;
    process.stdout.write(`fetch ${gem.slug}... `);
    try {
      const { status, body } = await get(pageUrl);
      if (status !== 200 || typeof body !== 'string') {
        console.log('fail status', status);
        continue;
      }
      const imgUrl = pickImage(body);
      if (!imgUrl) {
        console.log('no image');
        continue;
      }
      console.log(imgUrl.replace(BASE, ''));
      const { status: is, body: ibuf } = await get(imgUrl, true);
      if (is !== 200 || !Buffer.isBuffer(ibuf) || ibuf.length < 500) {
        console.log('  download fail', is, Buffer.isBuffer(ibuf) ? ibuf.length : 0);
        continue;
      }
      fs.writeFileSync(path.join(outDir, gem.file), ibuf);
      console.log('  saved', gem.file, ibuf.length);
      manifest[gem.slug] = gem.file;
    } catch (e) {
      console.log('error', e.message);
    }
  }
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('done', Object.keys(manifest).length);
})();
