/* images.test.js – Prüft die Bild-Pipeline (tools/optimize-images.js und tools/apply-images.js)
   und die richtige Auslieferung von AVIF. Arbeitet in einem Temp-Ordner, nicht im Projekt. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const sharp = require("sharp");
const { optimizeImages } = require("../tools/optimize-images");
const { applyImages, transformHtml } = require("../tools/apply-images");
const { startTestServer } = require("./helpers");

const silent = () => {};
async function makePhoto(file, width, height) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await sharp({ create: { width, height, channels: 3, background: "#8fb3c4" } }).jpeg().toFile(file);
}

const PAGE = `<!DOCTYPE html><html><head>
<link rel="preload" href="images/hero/hero-home.svg" as="image" fetchpriority="high">
</head><body>
<picture data-image="hero/hero-home"><img src="images/hero/hero-home.svg" width="1920" height="1080" alt="" fetchpriority="high" decoding="async"></picture>
<button type="button" class="gallery-item" data-gallery="g"><img src="images/gallery/gallery-1.svg" width="1200" height="1200" loading="lazy" alt="Terrasse" data-i18n-attr="alt:alt.20"></button>
<img src="images/logo.svg" alt="Logo">
</body></html>`;

test("Pipeline: Größen, Formate, kein Hochskalieren", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "img-")); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  await makePhoto(path.join(dir, "images-src/hero/hero-home.jpg"), 3000, 2000);
  await makePhoto(path.join(dir, "images-src/gallery/gallery-1.jpg"), 1000, 1000);
  await makePhoto(path.join(dir, "images-src/rooms/klein.jpg"), 300, 200);

  const manifest = await optimizeImages({ srcDir: path.join(dir, "images-src"), outDir: path.join(dir, "images"), log: silent });
  assert.deepEqual(manifest["hero/hero-home"].widths, [480, 800, 1200, 1600, 1920]);
  assert.deepEqual(manifest["hero/hero-home"].height, 1280);                       // Seitenverhältnis bleibt 3:2
  assert.deepEqual(manifest["gallery/gallery-1"].widths, [480, 800, 1000]);        // Originalbreite kommt dazu
  assert.deepEqual(manifest["rooms/klein"].widths, [300]);                         // nichts wird vergrößert
  for (const f of ["hero/hero-home-480.avif", "hero/hero-home-1920.webp", "gallery/gallery-1-1000.avif", "rooms/klein-300.webp"]) {
    assert.ok(fs.existsSync(path.join(dir, "images", f)), f);
  }
  assert.equal((await sharp(path.join(dir, "images/hero/hero-home-1200.webp")).metadata()).width, 1200);
  assert.ok(fs.existsSync(path.join(dir, "images/manifest.json")));

  // Gelöschtes Original: Varianten verschwinden beim nächsten Lauf
  fs.rmSync(path.join(dir, "images-src/rooms/klein.jpg"));
  await optimizeImages({ srcDir: path.join(dir, "images-src"), outDir: path.join(dir, "images"), log: silent });
  assert.equal(fs.existsSync(path.join(dir, "images/rooms/klein-300.webp")), false);
});

test("HTML: picture mit srcset, Preload, data-full, Logo bleibt unberührt", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "img-")); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  await makePhoto(path.join(dir, "images-src/hero/hero-home.jpg"), 3000, 2000);
  await makePhoto(path.join(dir, "images-src/gallery/gallery-1.jpg"), 1000, 1000);
  fs.writeFileSync(path.join(dir, "index.html"), PAGE);
  const manifest = await optimizeImages({ srcDir: path.join(dir, "images-src"), outDir: path.join(dir, "images"), log: silent });
  applyImages({ htmlDir: dir, manifest, log: silent });
  const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");

  assert.match(html, /<source type="image\/avif" srcset="images\/hero\/hero-home-480\.avif 480w, [^"]*1920w" sizes="100vw">/);
  assert.match(html, /<source type="image\/webp"/);
  assert.match(html, /<img src="images\/hero\/hero-home-1200\.webp" width="1920" height="1280" alt="" fetchpriority="high" decoding="async">/);
  assert.match(html, /<link rel="preload" as="image" type="image\/avif" imagesrcset="[^"]+" imagesizes="100vw" fetchpriority="high"/);
  assert.match(html, /data-full="images\/gallery\/gallery-1-1000\.webp"/);
  assert.match(html, /loading="lazy"/);                                  // Lazy Loading bleibt erhalten
  assert.match(html, /data-i18n-attr="alt:alt\.20"/);                     // Übersetzungs-Attribut bleibt erhalten
  assert.match(html, /<img src="images\/logo\.svg" alt="Logo">/);         // Logo unberührt

  // Zweiter Lauf: Ergebnis bleibt identisch
  applyImages({ htmlDir: dir, manifest, log: silent });
  assert.equal(fs.readFileSync(path.join(dir, "index.html"), "utf8"), html);
});

test("Ohne Foto bleibt der Platzhalter, und ein Foto kann wieder entfernt werden", () => {
  const withPlaceholder = transformHtml(PAGE, {}).html;
  assert.match(withPlaceholder, /<picture data-image="hero\/hero-home"><img src="images\/hero\/hero-home\.svg" width="1920" height="1080"/);
  assert.doesNotMatch(withPlaceholder, /<source/);
  const manifest = { "hero/hero-home": { width: 1920, height: 1280, widths: [480, 1920] } };
  const optimized = transformHtml(withPlaceholder, manifest).html;
  assert.match(optimized, /<source/);
  assert.equal(transformHtml(optimized, {}).html.includes("<source"), false);   // zurück zum Platzhalter
});

test("Server liefert AVIF mit dem richtigen Dateityp", async (t) => {
  const s = await startTestServer(); t.after(s.close);
  const file = path.join(__dirname, "..", "images", "zz-test.avif");
  await sharp({ create: { width: 8, height: 8, channels: 3, background: "#fff" } }).avif().toFile(file);
  t.after(() => fs.rmSync(file, { force: true }));
  const res = await s.get("/images/zz-test.avif");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/avif");
});
