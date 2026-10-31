/* ==========================================================
   apply-images.js – Stellt die Bilder in den HTML-Seiten um.

   Liest images/manifest.json (von optimize-images.js) und schreibt jedes Bild so:
   - Foto vorhanden:  <picture> mit AVIF- und WebP-Quellen in mehreren Größen (srcset)
   - Kein Foto da:    <picture> mit dem SVG-Platzhalter (images/<ordner>/<name>.svg)
   Zusätzlich: Hero-Preload-Links und data-full für die Lightbox (größte Variante).

   Das Skript ist wiederholbar: Du kannst es beliebig oft ausführen, das Ergebnis
   bleibt gleich. Es verändert nur Bild-Tags und Preload-Links, sonst nichts.

   Eigene "sizes"-Angabe für ein Bild: im <img> das Attribut data-sizes="..." setzen.
   Aufruf: npm run images   |   node tools/apply-images.js
   ========================================================== */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const GENERATED_ATTRS = new Set(["src", "srcset", "sizes", "width", "height"]);

/** Zerlegt einen Attribut-Text in [[name, wert|null], ...] (Reihenfolge bleibt erhalten). */
function parseAttrs(text) {
  return [...text.matchAll(/([^\s=\/>"']+)(?:\s*=\s*"([^"]*)")?/g)].map((m) => [m[1], m[2] ?? null]);
}
const attr = (attrs, name) => attrs.find(([n]) => n === name)?.[1];
const renderAttrs = (attrs) => attrs.map(([n, v]) => (v === null ? n : `${n}="${v}"`)).join(" ");

/** Standard-"sizes": Vollbild-Motive 100vw, sonst halbe Breite ab Tablet. */
function defaultSizes(key) {
  return /hero|band|wide|seaview/.test(key) ? "100vw" : "(max-width: 900px) 100vw, 50vw";
}

/** Fallback-Bild für alte Browser: größte Variante bis 1200 px. */
function fallbackWidth(widths) {
  return [...widths].reverse().find((w) => w <= 1200) ?? widths[0];
}

/** Liest Breite und Höhe eines SVG-Platzhalters, damit width/height immer stimmen. */
function placeholderSize(htmlDir, key) {
  const file = path.join(htmlDir, "images", key + ".svg");
  if (!fs.existsSync(file)) return null;
  const head = fs.readFileSync(file, "utf8").slice(0, 400);
  const w = head.match(/\bwidth="(\d+)"/)?.[1], h = head.match(/\bheight="(\d+)"/)?.[1];
  return w && h ? { width: w, height: h } : null;
}

const srcsetFor = (key, entry, format) => entry.widths.map((w) => `images/${key}-${w}.${format} ${w}w`).join(", ");

/** Baut den kanonischen <picture>-Block für ein Bild. */
function renderPicture(key, imgAttrs, manifest, htmlDir) {
  const entry = manifest[key];
  const rest = imgAttrs.filter(([n]) => !GENERATED_ATTRS.has(n));

  if (!entry) { // Platzhalter: Größen des bisherigen Tags behalten
    const size = placeholderSize(htmlDir, key) || { width: attr(imgAttrs, "width"), height: attr(imgAttrs, "height") };
    const keep = Object.entries(size).filter(([, v]) => v);
    return `<picture data-image="${key}"><img ${renderAttrs([["src", `images/${key}.svg`], ...keep, ...rest])}></picture>`;
  }

  const sizes = attr(rest, "data-sizes") || defaultSizes(key);
  const img = renderAttrs([["src", `images/${key}-${fallbackWidth(entry.widths)}.webp`], ["width", entry.width], ["height", entry.height], ...rest]);
  return `<picture data-image="${key}">` +
    `<source type="image/avif" srcset="${srcsetFor(key, entry, "avif")}" sizes="${sizes}">` +
    `<source type="image/webp" srcset="${srcsetFor(key, entry, "webp")}" sizes="${sizes}">` +
    `<img ${img}></picture>`;
}

/** Baut den Preload-Link für das wichtigste Bild der Seite. */
function renderPreload(key, attrs, manifest) {
  const entry = manifest[key];
  const priority = attr(attrs, "fetchpriority") || "high";
  if (!entry) return `<link rel="preload" href="images/${key}.svg" as="image" fetchpriority="${priority}" data-image="${key}">`;
  return `<link rel="preload" as="image" type="image/avif" imagesrcset="${srcsetFor(key, entry, "avif")}" imagesizes="${defaultSizes(key)}" fetchpriority="${priority}" data-image="${key}">`;
}

function transformHtml(html, manifest, htmlDir = ROOT) {
  let changes = 0;
  const count = (before, after) => { if (before !== after) changes++; return after; };

  // 1) Bilder: bestehende <picture data-image> und noch nicht umgestellte Platzhalter-<img>
  html = html.replace(/<picture data-image="([^"]+)">[\s\S]*?<\/picture>|<img\b[^>]*>/g, (match, pictureKey) => {
    if (pictureKey) {
      const inner = match.match(/<img\b([^>]*)>/);
      return inner ? count(match, renderPicture(pictureKey, parseAttrs(inner[1]), manifest, htmlDir)) : match;
    }
    const attrs = parseAttrs(match.slice(4, -1));
    const src = attr(attrs, "src") || "";
    const found = src.match(/^images\/([\w-]+\/[\w-]+)\.svg$/);
    return found ? count(match, renderPicture(found[1], attrs, manifest, htmlDir)) : match; // Logo und fremde Bilder unberührt
  });

  // 2) Preload-Links für Bilder
  html = html.replace(/<link\b[^>]*rel="preload"[^>]*as="image"[^>]*>/g, (match) => {
    const attrs = parseAttrs(match.slice(5, -1));
    const key = attr(attrs, "data-image") || (attr(attrs, "href") || "").match(/^images\/([\w-]+\/[\w-]+)\.svg$/)?.[1];
    return key ? count(match, renderPreload(key, attrs, manifest)) : match;
  });

  // 3) Lightbox: Button bekommt die größte Variante als data-full
  html = html.replace(/(<button\b[^>]*class="gallery-item"[^>]*?)(\s+data-full="[^"]*")?(\s*>\s*<picture data-image="([^"]+)">)/g, (match, open, oldFull, rest, key) => {
    const entry = manifest[key];
    const full = entry ? ` data-full="images/${key}-${entry.widths[entry.widths.length - 1]}.webp"` : "";
    return count(match, open + full + rest);
  });

  return { html, changes };
}

function applyImages({ htmlDir = ROOT, manifest, log = console.log } = {}) {
  const manifestData = manifest ?? JSON.parse(fs.existsSync(path.join(htmlDir, "images", "manifest.json")) ? fs.readFileSync(path.join(htmlDir, "images", "manifest.json"), "utf8") : "{}");
  const results = {};
  for (const file of fs.readdirSync(htmlDir).filter((f) => f.endsWith(".html"))) {
    const full = path.join(htmlDir, file);
    const original = fs.readFileSync(full, "utf8");
    const { html, changes } = transformHtml(original, manifestData, htmlDir);
    if (html !== original) fs.writeFileSync(full, html);
    results[file] = changes;
    log(`${html !== original ? "✓ aktualisiert" : "· unverändert "} ${file}`);
  }
  return results;
}

if (require.main === module) applyImages();

module.exports = { applyImages, transformHtml };
