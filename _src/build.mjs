// Builds a fully self-contained index.html for the Talon landing page.
//
// The phone shows THE REAL PROTOTYPES, not a recreation: it embeds
//   ui-lab/prototypes/02-first-action  (the ship flight)  and
//   ui-lab/prototypes/16-the-day       (the day home)
// as srcdoc iframes. Each prototype document is made self-contained here:
// shared CSS inlined, Google fonts swapped for base64 @font-face, the local
// day-data/content-data scripts inlined, and EVERY referenced image replaced
// with a sharp-optimized webp data URI. 02's final hand-off to the paywall is
// patched into a postMessage so the landing page can crossfade to the day.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire('D:/TalonV3.1/frontend/package.json');
const sharp = require('sharp');

const FRONT = 'D:/TalonV3.1/frontend';
const LAB = 'D:/TalonV3.1/ui-lab';
const IMG_ROOT = `${FRONT}/assets/images`;
const GF = `${FRONT}/node_modules/@expo-google-fonts`;

const b64 = (p) => readFileSync(p).toString('base64');
const fontFace = (fam, w, p) =>
  `@font-face{font-family:'${fam}';font-style:normal;font-weight:${w};font-display:swap;` +
  `src:url(data:font/ttf;base64,${b64(p)}) format('truetype');}`;

// the exact faces the prototypes request from Google Fonts
const PROTO_FONT_CSS = [
  fontFace('Cinzel', 400, `${GF}/cinzel/400Regular/Cinzel_400Regular.ttf`),
  fontFace('Cinzel', 700, `${GF}/cinzel/700Bold/Cinzel_700Bold.ttf`),
  fontFace('Cinzel Decorative', 700, `${GF}/cinzel-decorative/700Bold/CinzelDecorative_700Bold.ttf`),
  fontFace('Inter', 400, `${GF}/inter/400Regular/Inter_400Regular.ttf`),
  fontFace('Inter', 500, `${GF}/inter/500Medium/Inter_500Medium.ttf`),
  fontFace('Inter', 600, `${GF}/inter/600SemiBold/Inter_600SemiBold.ttf`),
  fontFace('Inter', 700, `${GF}/inter/700Bold/Inter_700Bold.ttf`),
  fontFace('Share Tech Mono', 400, `${GF}/share-tech-mono/400Regular/ShareTechMono_400Regular.ttf`),
].join('\n');

// ── image registry: everything under assets/images (top level + categories) ──
function listImages() {
  const out = [];
  for (const f of readdirSync(IMG_ROOT)) {
    const p = join(IMG_ROOT, f);
    if (statSync(p).isFile() && /\.(png|jpe?g|webp)$/i.test(f)) out.push({ rel: f, abs: p });
  }
  const catDir = join(IMG_ROOT, 'categories');
  for (const f of readdirSync(catDir)) {
    const p = join(catDir, f);
    if (statSync(p).isFile() && /\.(png|jpe?g|webp)$/i.test(f)) out.push({ rel: 'categories/' + f, abs: p });
  }
  return out;
}
const ALL_IMAGES = listImages();

const widthFor = (rel) =>
  rel.startsWith('categories/') ? 380
  : /Ship-/.test(rel) ? 560
  : /Prototype-/.test(rel) ? 640
  : /Planet/.test(rel) ? 620
  : /Badge|Milestone/.test(rel) ? 300
  : /MainOrb/.test(rel) ? 340
  : 512;

const uriCache = new Map();
async function dataUri(a) {
  if (!uriCache.has(a.rel)) {
    const buf = await sharp(a.abs)
      .resize({ width: widthFor(a.rel), withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    uriCache.set(a.rel, 'data:image/webp;base64,' + buf.toString('base64'));
  }
  return uriCache.get(a.rel);
}

const escScript = (s) => s.replace(/<\/script/gi, '<\\/script');

// ── make one prototype document fully self-contained ──
async function prepDoc(file, { isFlight = false } = {}) {
  let doc = readFileSync(file, 'utf8');

  // shared lab CSS → inline
  doc = doc.replace(/<link rel="stylesheet" href="\.\.\/\.\.\/shared\/phone\.css" \/>/,
    () => `<style>${readFileSync(`${LAB}/shared/phone.css`, 'utf8')}</style>`);
  doc = doc.replace(/<link rel="stylesheet" href="\.\.\/\.\.\/shared\/bgfx\.css" \/>/,
    () => `<style>${readFileSync(`${LAB}/shared/bgfx.css`, 'utf8')}</style>`);

  // Google Fonts → embedded faces (artifact CSP blocks font CDNs)
  doc = doc.replace(/<link rel="preconnect"[^>]*\/>\s*/g, '');
  doc = doc.replace(/<link href="https:\/\/fonts\.googleapis\.com[^"]*"[^>]*\/>/,
    () => `<style>${PROTO_FONT_CSS}</style>`);

  // the day's local data scripts → inline
  doc = doc.replace(/<script src="day-data\.js"><\/script>/,
    () => `<script>${escScript(readFileSync(`${LAB}/prototypes/16-the-day/day-data.js`, 'utf8'))}</script>`);
  doc = doc.replace(/<script src="content-data\.js"><\/script>/,
    () => `<script>${escScript(readFileSync(`${LAB}/prototypes/16-the-day/content-data.js`, 'utf8'))}</script>`);

  if (isFlight) {
    // the flight's paywall hand-off becomes the signal to swap to the day
    doc = doc.replace("location.href = '../14-paywall/index.html?' + q.toString();",
      "try { parent.postMessage('talon-02-done', '*'); } catch (_e) {}");
    // and the launch presses itself after the brief settles
    doc = doc.replace('</body>',
      `<script>window.addEventListener('load',function(){setTimeout(function(){var b=document.getElementById('launchBtn');if(b)b.click();},1700);});</script>\n</body>`);
  }

  // any remaining cross-prototype navigation becomes a no-op inside the embed
  doc = doc.split('location.href =').join('window.__nav =');

  // images: full lab paths first…
  for (const a of ALL_IMAGES) {
    const full = `../../../frontend/assets/images/${a.rel}`;
    if (doc.includes(full)) doc = doc.split(full).join(await dataUri(a));
  }
  // …then quoted literals (data files + JS maps), folder-relative and bare
  for (const a of ALL_IMAGES) {
    const names = a.rel === basename(a.rel) ? [a.rel] : [a.rel, basename(a.rel)];
    for (const n of names) {
      for (const q of [`'${n}'`, `"${n}"`]) {
        if (doc.includes(q)) doc = doc.split(q).join(`'${await dataUri(a)}'`);
      }
    }
  }
  // all refs are data URIs now — the runtime prefixes must be empty
  doc = doc.replace("const ASSETS = '../../../frontend/assets/images/';", "const ASSETS = '';");
  doc = doc.replace("const ASSETS_CAT = 'categories/';", "const ASSETS_CAT = '';");
  return doc;
}

// a doc as a safe JS string literal (won't terminate the host <script>)
const jsLit = (s) =>
  JSON.stringify(s)
    .replace(/<\//g, '<\\/')
    .replace(/<script/gi, '<\\script')
    .replace(/<!--/g, '<\\!--');

// ── landing page's own fonts + wordmark orb ──
const LANDING_FONTS = {
  '@@CINZEL700@@': `${GF}/cinzel/700Bold/Cinzel_700Bold.ttf`,
  '@@CINZEL900@@': `${GF}/cinzel/900Black/Cinzel_900Black.ttf`,
  '@@INTER400@@': `${GF}/inter/400Regular/Inter_400Regular.ttf`,
  '@@INTER600@@': `${GF}/inter/600SemiBold/Inter_600SemiBold.ttf`,
};

const docFlight = await prepDoc(`${LAB}/prototypes/02-first-action/index.html`, { isFlight: true });

// the home is OUR real app's home (DayV4 + TalonTabBar ported value-for-value
// in home.html), not the older 16-the-day prototype
async function buildHomeDoc() {
  let doc = readFileSync(new URL('./home.html', import.meta.url), 'utf8');
  doc = doc.replace('@@FONTS@@', () => PROTO_FONT_CSS);
  doc = doc.split('@@HOME_PLANET@@').join(await dataUri(ALL_IMAGES.find((a) => a.rel === 'FitnessPlanet-1.png')));
  doc = doc.split('@@ORB@@').join(await dataUri(ALL_IMAGES.find((a) => a.rel === 'MainOrb-2.png')));
  return doc;
}
const docDay = await buildHomeDoc();

let html = readFileSync(new URL('./page.html', import.meta.url), 'utf8');
for (const [ph, path] of Object.entries(LANDING_FONTS)) {
  html = html.split(ph).join(`data:font/ttf;base64,${b64(path)}`);
}
html = html.split('@@ORB@@').join(await dataUri(ALL_IMAGES.find((a) => a.rel === 'MainOrb-2.png')));
html = html.replace('@@DOC_FLIGHT@@', () => jsLit(docFlight));
html = html.replace('@@DOC_DAY@@', () => jsLit(docDay));

writeFileSync(new URL('./index.html', import.meta.url), html);
console.log(`built index.html — ${(html.length / 1024 / 1024).toFixed(2)} MB  (flight ${(docFlight.length / 1e6).toFixed(2)}MB, day ${(docDay.length / 1e6).toFixed(2)}MB, ${uriCache.size} images)`);
