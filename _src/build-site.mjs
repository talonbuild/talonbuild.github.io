// Builds the REAL talonapp.co website (GitHub Pages, plain static files) into
// the cloned repo. Unlike build.mjs (one self-contained artifact file), this
// emits a proper site:
//   index.html            — the new landing (head carried from the old site)
//   phone/flight.html     — the real 02-first-action prototype, file-based
//   phone/day.html        — the real app home (DayV4 + TalonTabBar port)
//   get/index.html        — the Instagram → App Store smart redirect
//   assets/v4/*.webp      — optimized art   assets/fonts/*.ttf — self-hosted type
//   v1/                   — the archived old homepage + about page
// Untouched: CNAME, privacy-policy.html, reset.html, verify.html, habit-test/,
// existing assets/.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire('D:/TalonV3.1/frontend/package.json');
const sharp = require('sharp');

const FRONT = 'D:/TalonV3.1/frontend';
const LAB = 'D:/TalonV3.1/ui-lab';
const IMG_ROOT = `${FRONT}/assets/images`;
const GF = `${FRONT}/node_modules/@expo-google-fonts`;
const SRC = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SITE = 'C:/Users/leona/AppData/Local/Temp/claude/d--TalonV3-1/eb4cd773-3ab9-4393-8db4-9c44dc17d8f0/scratchpad/talon-site';

for (const d of ['assets/v4', 'assets/fonts', 'phone', 'get', 'v1']) mkdirSync(join(SITE, d), { recursive: true });

// ── fonts: self-hosted files ──
const FONT_FILES = {
  'Cinzel_400Regular.ttf': `${GF}/cinzel/400Regular/Cinzel_400Regular.ttf`,
  'Cinzel_700Bold.ttf': `${GF}/cinzel/700Bold/Cinzel_700Bold.ttf`,
  'Cinzel_900Black.ttf': `${GF}/cinzel/900Black/Cinzel_900Black.ttf`,
  'CinzelDecorative_700Bold.ttf': `${GF}/cinzel-decorative/700Bold/CinzelDecorative_700Bold.ttf`,
  'Inter_400Regular.ttf': `${GF}/inter/400Regular/Inter_400Regular.ttf`,
  'Inter_500Medium.ttf': `${GF}/inter/500Medium/Inter_500Medium.ttf`,
  'Inter_600SemiBold.ttf': `${GF}/inter/600SemiBold/Inter_600SemiBold.ttf`,
  'Inter_700Bold.ttf': `${GF}/inter/700Bold/Inter_700Bold.ttf`,
  'ShareTechMono_400Regular.ttf': `${GF}/share-tech-mono/400Regular/ShareTechMono_400Regular.ttf`,
};
for (const [name, src] of Object.entries(FONT_FILES)) copyFileSync(src, join(SITE, 'assets/fonts', name));

const face = (fam, w, file) =>
  `@font-face{font-family:'${fam}';font-style:normal;font-weight:${w};font-display:swap;src:url(/assets/fonts/${file}) format('truetype');}`;
const PROTO_FONT_CSS = [
  face('Cinzel', 400, 'Cinzel_400Regular.ttf'),
  face('Cinzel', 700, 'Cinzel_700Bold.ttf'),
  face('Cinzel Decorative', 700, 'CinzelDecorative_700Bold.ttf'),
  face('Inter', 400, 'Inter_400Regular.ttf'),
  face('Inter', 500, 'Inter_500Medium.ttf'),
  face('Inter', 600, 'Inter_600SemiBold.ttf'),
  face('Inter', 700, 'Inter_700Bold.ttf'),
  face('Share Tech Mono', 400, 'ShareTechMono_400Regular.ttf'),
].join('\n');

// ── images: optimized webp files under /assets/v4 ──
import { readdirSync, statSync } from 'node:fs';
function listImages() {
  const out = [];
  for (const f of readdirSync(IMG_ROOT)) {
    const p = join(IMG_ROOT, f);
    if (statSync(p).isFile() && /\.(png|jpe?g|webp)$/i.test(f)) out.push({ rel: f, abs: p });
  }
  for (const f of readdirSync(join(IMG_ROOT, 'categories'))) {
    const p = join(IMG_ROOT, 'categories', f);
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

const refCache = new Map();
async function fileRef(a) {
  if (!refCache.has(a.rel)) {
    const out = basename(a.rel).replace(/\.(png|jpe?g)$/i, '.webp');
    const buf = await sharp(a.abs).resize({ width: widthFor(a.rel), withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    writeFileSync(join(SITE, 'assets/v4', out), buf);
    refCache.set(a.rel, '/assets/v4/' + out);
  }
  return refCache.get(a.rel);
}

const escScript = (s) => s.replace(/<\/script/gi, '<\\/script');

// ── phone/flight.html: the real 02-first-action, file-based ──
async function buildFlight() {
  let doc = readFileSync(`${LAB}/prototypes/02-first-action/index.html`, 'utf8');
  doc = doc.replace(/<link rel="stylesheet" href="\.\.\/\.\.\/shared\/phone\.css" \/>/,
    () => `<style>${readFileSync(`${LAB}/shared/phone.css`, 'utf8')}</style>`);
  doc = doc.replace(/<link rel="stylesheet" href="\.\.\/\.\.\/shared\/bgfx\.css" \/>/,
    () => `<style>${readFileSync(`${LAB}/shared/bgfx.css`, 'utf8')}</style>`);
  doc = doc.replace(/<link rel="preconnect"[^>]*\/>\s*/g, '');
  doc = doc.replace(/<link href="https:\/\/fonts\.googleapis\.com[^"]*"[^>]*\/>/, () => `<style>${PROTO_FONT_CSS}</style>`);
  // the paywall hand-off becomes the signal to swap to the day
  doc = doc.replace("location.href = '../14-paywall/index.html?' + q.toString();",
    "try { parent.postMessage('talon-02-done', '*'); } catch (_e) {}");
  doc = doc.replace('</body>',
    `<script>window.addEventListener('load',function(){setTimeout(function(){var b=document.getElementById('launchBtn');if(b)b.click();},1700);});</script>\n</body>`);
  doc = doc.split('location.href =').join('window.__nav =');
  for (const a of ALL_IMAGES) {
    const full = `../../../frontend/assets/images/${a.rel}`;
    if (doc.includes(full)) doc = doc.split(full).join(await fileRef(a));
  }
  for (const a of ALL_IMAGES) {
    const names = a.rel === basename(a.rel) ? [a.rel] : [a.rel, basename(a.rel)];
    for (const n of names) for (const q of [`'${n}'`, `"${n}"`]) {
      if (doc.includes(q)) doc = doc.split(q).join(`'${await fileRef(a)}'`);
    }
  }
  doc = doc.replace("const ASSETS = '../../../frontend/assets/images/';", "const ASSETS = '';");
  writeFileSync(join(SITE, 'phone/flight.html'), doc);
}

// ── phone/day.html: the real app home ──
async function buildDay() {
  let doc = readFileSync(join(SRC, 'home.html'), 'utf8');
  doc = doc.replace('@@FONTS@@', () => PROTO_FONT_CSS);
  doc = doc.split('@@HOME_PLANET@@').join(await fileRef(ALL_IMAGES.find((a) => a.rel === 'FitnessPlanet-1.png')));
  doc = doc.split('@@ORB@@').join(await fileRef(ALL_IMAGES.find((a) => a.rel === 'MainOrb-2.png')));
  writeFileSync(join(SITE, 'phone/day.html'), doc);
}

// ── favicons from the App Store icon ──
async function buildIcons() {
  const src = `${IMG_ROOT}/AppStoreIcon.png`;
  await sharp(src).resize(180, 180).png().toFile(join(SITE, 'assets/v4/apple-touch-icon.png'));
  await sharp(src).resize(48, 48).png().toFile(join(SITE, 'assets/v4/favicon-48.png'));
  await sharp(src).resize(32, 32).png().toFile(join(SITE, 'assets/v4/favicon-32.png'));
}

// ── index.html: head carried from the old site + the new landing body ──
async function buildIndex() {
  let page = readFileSync(join(SRC, 'page.html'), 'utf8');
  page = page.split('@@CINZEL700@@').join('/assets/fonts/Cinzel_700Bold.ttf');
  page = page.split('@@CINZEL900@@').join('/assets/fonts/Cinzel_900Black.ttf');
  page = page.split('@@INTER400@@').join('/assets/fonts/Inter_400Regular.ttf');
  page = page.split('@@INTER600@@').join('/assets/fonts/Inter_600SemiBold.ttf');
  page = page.split('@@ORB@@').join(await fileRef(ALL_IMAGES.find((a) => a.rel === 'MainOrb-2.png')));
  // the phone loads the real pages instead of inline srcdoc documents
  page = page.replace('var DOC_FLIGHT = @@DOC_FLIGHT@@;', "var DOC_FLIGHT = '/phone/flight.html';");
  page = page.replace('var DOC_DAY = @@DOC_DAY@@;', "var DOC_DAY = '/phone/day.html';");
  page = page.split('srcdoc = DOC_').join('src = DOC_');

  // split the leading <style> into the head
  const styleEnd = page.indexOf('</style>') + '</style>'.length;
  const styleBlock = page.slice(0, styleEnd);
  const body = page.slice(styleEnd);

  const head = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-itunes-app" content="app-id=6758687009">
<meta name="theme-color" content="#06080F">
<title>Talon | Habit Builder. Built to Win.</title>
<meta name="description" content="Tell Talon your goal. It gives you one small action a day until the habit is built. Not a tracker. A habit system. Free on the App Store.">
<link rel="canonical" href="https://talonapp.co/">
<meta property="og:type" content="website">
<meta property="og:url" content="https://talonapp.co">
<meta property="og:title" content="Talon | Habit Builder">
<meta property="og:description" content="You bring the goal. Talon brings the daily plan. Free on the App Store.">
<meta property="og:image" content="https://talonapp.co/assets/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Talon | Built To Win">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@talonhabits">
<meta name="twitter:title" content="Talon | Habit Builder">
<meta name="twitter:description" content="You bring the goal. Talon brings the daily plan. Free on the App Store.">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/v4/favicon-32.png">
<link rel="icon" type="image/png" sizes="48x48" href="/assets/v4/favicon-48.png">
<link rel="apple-touch-icon" href="/assets/v4/apple-touch-icon.png">
${styleBlock}
</head>
<body>
${body}
</body>
</html>
`;
  writeFileSync(join(SITE, 'index.html'), head);
}

// ── get/index.html: the Instagram → App Store smart redirect (bio link) ──
async function buildGet() {
  const orb = await fileRef(ALL_IMAGES.find((a) => a.rel === 'MainOrb-2.png'));
  const doc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#06080F">
<title>Get Talon</title>
<noscript><meta http-equiv="refresh" content="0;url=https://apps.apple.com/us/app/talon-habit-builder/id6758687009"></noscript>
<style>
@font-face{font-family:'Cinzel';font-weight:700;font-display:swap;src:url(/assets/fonts/Cinzel_700Bold.ttf) format('truetype');}
*{margin:0;padding:0;box-sizing:border-box}
body{min-height:100dvh;background:#06080F;color:#EEF3FC;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;padding:28px;-webkit-font-smoothing:antialiased}
.card{max-width:400px;width:100%;text-align:center}
.orb{width:74px;height:74px;border-radius:50%;object-fit:cover;margin:0 auto 16px;display:block;filter:drop-shadow(0 0 22px rgba(79,139,255,.7))}
.mark{font-family:'Cinzel',serif;font-weight:700;font-size:26px;letter-spacing:.22em;color:#fff}
.sub{color:#A6B2CC;font-size:15.5px;line-height:1.55;margin-top:10px}
.btn{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:26px;height:58px;border-radius:16px;background:linear-gradient(180deg,#f6f9ff,#d2ddff);color:#06080F;font-weight:600;font-size:16.5px;text-decoration:none;box-shadow:0 14px 42px rgba(79,139,255,.35)}
.btn svg{width:22px;height:22px}
.steps{margin-top:22px;padding:18px;border:1px solid rgba(156,192,255,.24);border-radius:16px;background:#0D1426;text-align:left;display:none}
.steps .lead{font-size:15px;line-height:1.5;color:#A6B2CC}
.step{display:flex;align-items:center;gap:12px;margin-top:12px;font-size:16px;color:#EEF3FC}
.step b{color:#fff}
.num{flex:none;width:28px;height:28px;border-radius:999px;display:grid;place-items:center;font-weight:600;font-size:14px;color:#9CC0FF;background:rgba(79,139,255,.14);border:1px solid rgba(156,192,255,.4)}
.show .steps{display:block}
.tiny{margin-top:16px;font-size:12.5px;color:#6B789A}
.tiny a{color:#9CC0FF;text-decoration:none}
</style>
</head>
<body>
<div class="card" id="card">
  <img class="orb" src="${orb}" alt="">
  <div class="mark">TALON</div>
  <p class="sub">One small action a day. Free on the App&nbsp;Store.</p>
  <a class="btn" id="go" href="https://apps.apple.com/us/app/talon-habit-builder/id6758687009">
    <svg viewBox="0 0 384 512" fill="currentColor"><path d="M318.7 268c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.6zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
    Open the App Store
  </a>
  <div class="steps">
    <div class="lead">Instagram blocks App&nbsp;Store downloads. Two taps fix it:</div>
    <div class="step"><span class="num">1</span><span>Tap the <b>&bull;&bull;&bull;</b> at the top right</span></div>
    <div class="step"><span class="num">2</span><span>Tap <b>Open in external browser</b></span></div>
  </div>
  <p class="tiny"><a href="https://talonapp.co">talonapp.co</a></p>
</div>
<script>
(function(){
  var HTTPS='https://apps.apple.com/us/app/talon-habit-builder/id6758687009';
  var ITMS='itms-apps://apps.apple.com/us/app/talon-habit-builder/id6758687009';
  var ua=navigator.userAgent||'';
  var isIOS=/iP(hone|od|ad)/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  var inApp=/Instagram/i.test(ua)||/FBAN|FBAV|FB_IAB|Messenger/i.test(ua);
  var card=document.getElementById('card'), go=document.getElementById('go');

  // real browser: straight to the store, nothing to see here
  if(!inApp){ location.replace(HTTPS); return; }

  // in-app browser: show the guidance immediately, and on iOS also try the
  // direct native hand-off (harmless if the WebView blocks it)
  card.classList.add('show');
  function attempt(){ try{ location.href=ITMS; }catch(e){} }
  if(isIOS){ setTimeout(attempt, 250); }

  go.addEventListener('click', function(e){
    if(!isIOS) return;               // Android and others: let the anchor work
    e.preventDefault();
    attempt();
    setTimeout(function(){ if(document.visibilityState!=='hidden') location.href=HTTPS; }, 1200);
  });
})();
</script>
</body>
</html>
`;
  writeFileSync(join(SITE, 'get/index.html'), doc);
}

// ── v1/: archive the old homepage + about page ──
function archiveV1() {
  const note = '<!-- ARCHIVED: Talon website v1 (replaced by v2 on 2026-08-08). Kept for reference. -->\n';
  for (const f of ['index.html', 'about.html']) {
    const p = join(SITE, f);
    if (existsSync(p)) writeFileSync(join(SITE, 'v1', f), note + readFileSync(p, 'utf8'));
  }
}

function writeReadme() {
  writeFileSync(join(SITE, 'README.md'), `# talonbuild.github.io

Talon public website (talonapp.co) — marketing, privacy policy, and app auth pages.

- \`index.html\` — v2 landing page (one goal: App Store downloads). The phone runs the real product flight (\`phone/flight.html\`) and lands on the real app home (\`phone/day.html\`).
- \`get/\` — Instagram/social bio link (talonapp.co/get): detects in-app browsers and hands off to the App Store with the least possible friction.
- \`privacy-policy.html\`, \`reset.html\`, \`verify.html\`, \`habit-test/\`, \`about.html\` — live pages the app and App Store listing depend on. Do not move.
- \`assets/\` — images (v1 + \`assets/v4/\` for v2) and self-hosted fonts (\`assets/fonts/\`).
- \`v1/\` — the archived v1 homepage and about page.
`);
}

archiveV1();
await buildIcons();
await buildFlight();
await buildDay();
await buildIndex();
await buildGet();
writeReadme();
console.log(`site built into ${SITE} — ${refCache.size} images written`);
