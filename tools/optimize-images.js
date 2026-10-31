/* ==========================================================
   optimize-images.js – Bild-Optimierung

   Eingabe:  images-src/<ordner>/<name>.jpg|png|webp|tiff   (deine Originale)
   Ausgabe:  images/<ordner>/<name>-480.avif, -480.webp, -800 ... -1920
             images/manifest.json  (Größen je Bild, wird von apply-images.js gelesen)

   Aufruf:   npm run images        (optimiert und stellt die Seiten um)
             node tools/optimize-images.js

   Die Originale in images-src/ werden vom Webserver NICHT ausgeliefert.
   Es werden nie Bilder hochskaliert: ein 1000 px breites Original erzeugt nur Größen bis 1000 px.
   ========================================================== */
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const WIDTHS = [480, 800, 1200, 1600, 1920];
const SOURCE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".avif"]);
const QUALITY = { webp: 80, avif: 52 }; // AVIF erreicht bei niedrigerem Wert dieselbe Optik

/** Sucht alle Bilddateien unterhalb eines Ordners. */
function findSourceImages(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return findSourceImages(full);
    return SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) ? [full] : [];
  });
}

/** Breite und Höhe nach EXIF-Drehung (Handyfotos sind oft gedreht gespeichert). */
async function readSize(file) {
  const meta = await sharp(file).metadata();
  const rotated = meta.orientation && meta.orientation >= 5;
  return { width: rotated ? meta.height : meta.width, height: rotated ? meta.width : meta.height };
}

/** Löscht erzeugte Varianten, deren Original nicht mehr existiert. */
function removeStaleOutputs(outDir, keep) {
  if (!fs.existsSync(outDir)) return;
  for (const entry of fs.readdirSync(outDir, { withFileTypes: true })) {
    const full = path.join(outDir, entry.name);
    if (entry.isDirectory()) { removeStaleOutputs(full, keep); continue; }
    if (/-\d+\.(webp|avif)$/.test(entry.name) && !keep.has(path.resolve(full))) fs.unlinkSync(full);
  }
}

async function optimizeImages({ srcDir = path.join(ROOT, "images-src"), outDir = path.join(ROOT, "images"), log = console.log } = {}) {
  const manifest = {};
  const written = new Set();

  for (const file of findSourceImages(srcDir)) {
    const key = path.relative(srcDir, file).replace(/\.[^.]+$/, "").split(path.sep).join("/");
    if (manifest[key]) { log(`! Übersprungen (doppelter Name mit anderer Endung): ${file}`); continue; }

    const { width: origWidth, height: origHeight } = await readSize(file);
    let widths = WIDTHS.filter((w) => w <= origWidth);
    if (!widths.length) widths = [origWidth]; // sehr kleines Original: nur diese eine Größe
    // Liegt die Originalbreite zwischen der größten Stufe und 1920 px, kommt sie als letzte Größe dazu
    else if (origWidth > widths[widths.length - 1] && origWidth <= WIDTHS[WIDTHS.length - 1]) widths.push(origWidth);

    let totalBytes = 0;
    for (const width of widths) {
      for (const format of ["avif", "webp"]) {
        const target = path.join(outDir, `${key}-${width}.${format}`);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        const info = await sharp(file).rotate().resize({ width, withoutEnlargement: true })[format]({ quality: QUALITY[format] }).toFile(target);
        written.add(path.resolve(target));
        totalBytes += info.size;
      }
    }

    const largest = widths[widths.length - 1];
    manifest[key] = { width: largest, height: Math.round((origHeight * largest) / origWidth), widths };
    log(`✓ ${key}: ${widths.join(", ")} px (AVIF + WebP, zusammen ${(totalBytes / 1024).toFixed(0)} KB)`);
  }

  removeStaleOutputs(outDir, written);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  if (!Object.keys(manifest).length) log("Keine Originale in images-src/ gefunden. Die Seiten zeigen weiter die Platzhalter.");
  return manifest;
}

if (require.main === module) {
  optimizeImages().catch((error) => { console.error("Fehler bei der Bildoptimierung:", error.message); process.exit(1); });
}

module.exports = { optimizeImages, WIDTHS };
