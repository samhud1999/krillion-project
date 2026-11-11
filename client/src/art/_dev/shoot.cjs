/* Screenshot the built gallery with the preinstalled Playwright. */
const path = require('node:path');
const http = require('node:http');
const fs = require('node:fs');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../../../../tmp/art-gallery');
const out = path.resolve(__dirname, '../../../../tmp');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/' || p === '') p = '/gallery.html';
  const file = path.join(root, p);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    return res.end('nf');
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const browser = await chromium.launch();
  const shots = [
    { name: 'art-desktop', w: 1920, h: 1080, full: true },
    { name: 'art-phone', w: 390, h: 844, full: true },
  ];
  for (const s of shots) {
    const page = await browser.newPage({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => (m.type() === 'error' ? errors.push(m.text()) : null));
    await page.goto(`http://localhost:${port}/gallery.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(out, `${s.name}.png`), fullPage: s.full });
    // crops of specific sections for close inspection
    const sections = await page.$$('section');
    for (let i = 0; i < sections.length; i++) {
      await sections[i].screenshot({ path: path.join(out, `${s.name}-s${i}.png`) });
    }
    console.log(s.name, 'errors:', errors.length ? errors : 'none');
    if (s.name === 'art-desktop') {
      // Does a marker actually ease between depths inside the SVG?
      const read = () => page.$eval('[data-testid="motion-demo"] .sck-marker', (g) => getComputedStyle(g).transform);
      const before = await read();
      await page.click('[data-testid="motion-next"]');
      await page.waitForTimeout(500);
      const mid = await read();
      await page.waitForTimeout(1800);
      const after = await read();
      const ok = before !== mid && mid !== after && before !== after;
      console.log('motion check', ok ? 'PASS' : 'FAIL', { before, mid, after });
      await page.$eval('[data-testid="motion-demo"]', (el) => el.scrollIntoView());
      await page.screenshot({ path: path.join(out, 'art-motion.png'), clip: { x: 0, y: 0, width: 1920, height: 1080 } });
    }
    await page.close();
  }
  await browser.close();
  server.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
