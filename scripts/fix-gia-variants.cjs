const fs = require('fs');
const https = require('https');
const path = require('path');

const BASE = 'https://www.gia.edu';
const outDir = path.join(__dirname, '../assets/images/gems');

function get(url, binary = false) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            Referer: BASE + '/gem-encyclopedia',
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
      )
      .on('error', reject);
  });
}

function abs(src) {
  if (src.startsWith('http')) return src;
  if (src.startsWith('//')) return 'https:' + src;
  return BASE + src;
}

async function downloadByAlt(slug, alt, file) {
  const { status, body } = await get(`${BASE}/${slug}`);
  if (status !== 200) {
    console.log(slug, 'fail', status);
    return false;
  }
  const imgs = [...body.matchAll(/<img[^>]+>/gi)].map((m) => m[0]);
  const hit =
    imgs.find((t) => new RegExp(`alt=["']${alt}["']`, 'i').test(t)) ||
    imgs.find((t) => /polished/i.test(t) && new RegExp(alt, 'i').test(t));
  if (!hit) {
    console.log(slug, 'no alt match', alt);
    return false;
  }
  const src = hit.match(/src=["']([^"']+)/i);
  if (!src) return false;
  const url = abs(src[1]);
  console.log(slug, '->', url);
  const { status: s, body: buf } = await get(url, true);
  if (s !== 200 || buf.length < 1000) {
    console.log('bad download', s, buf.length);
    return false;
  }
  fs.writeFileSync(path.join(outDir, file), buf);
  console.log('saved', file, buf.length);
  return true;
}

(async () => {
  await downloadByAlt('amethyst', 'Amethyst', 'amethyst.png');

  // Variants that share encyclopedia heroes
  fs.copyFileSync(path.join(outDir, 'sapphire.png'), path.join(outDir, 'blue-sapphire.png'));
  fs.copyFileSync(path.join(outDir, 'sapphire.png'), path.join(outDir, 'star-sapphire.png'));
  fs.copyFileSync(path.join(outDir, 'morganite.png'), path.join(outDir, 'padparadscha.png'));
  fs.copyFileSync(path.join(outDir, 'sunstone.png'), path.join(outDir, 'cats-eye.png'));
  fs.copyFileSync(path.join(outDir, 'diamond.png'), path.join(outDir, 'other.png'));
  console.log('variants copied');
})();
