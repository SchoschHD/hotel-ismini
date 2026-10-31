/* i18n.test.js – Prüft die Mehrsprachigkeit (EN, DE, EL).
   - Alle Sprachen haben dieselben Schlüssel, keine leeren Texte
   - Platzhalter wie {n} stimmen in allen Sprachen überein
   - Jeder in HTML oder JavaScript benutzte Schlüssel existiert
   - Jedes Bild mit Alt-Text ist übersetzbar, griechische Texte enthalten griechische Buchstaben */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

/** Lädt ein Wörterbuch (die Dateien sind ES-Module, das Projekt nutzt CommonJS). */
function loadDictionary(lang) {
  const source = read("js", "i18n", lang + ".js").replace("export default", "module.exports =");
  const module = { exports: {} };
  new Function("module", source)(module);
  return module.exports;
}

const dict = { en: loadDictionary("en"), de: loadDictionary("de"), el: loadDictionary("el") };
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));

test("Alle Sprachen haben exakt dieselben Schlüssel", () => {
  const reference = Object.keys(dict.en).sort();
  for (const lang of ["de", "el"]) {
    const keys = Object.keys(dict[lang]).sort();
    assert.deepEqual(reference.filter((k) => !keys.includes(k)), [], `${lang}: fehlende Schlüssel`);
    assert.deepEqual(keys.filter((k) => !reference.includes(k)), [], `${lang}: überzählige Schlüssel`);
  }
});

test("Keine leeren Texte", () => {
  for (const [lang, entries] of Object.entries(dict)) {
    for (const [key, value] of Object.entries(entries)) assert.ok(String(value).trim().length > 0, `${lang}: ${key} ist leer`);
  }
});

test("Platzhalter ({n}, {a}, {c}) stimmen in allen Sprachen überein", () => {
  const placeholders = (text) => (text.match(/\{\w+\}/g) || []).sort().join(",");
  for (const key of Object.keys(dict.en)) {
    for (const lang of ["de", "el"]) assert.equal(placeholders(dict[lang][key]), placeholders(dict.en[key]), `${lang}: ${key}`);
  }
});

test("Griechische Texte enthalten griechische Buchstaben (außer Eigennamen)", () => {
  const allowedSame = ["footer.rights", "rooms.r3", "nav.wellness", "meta.well.title", "meta.home.title"];
  for (const [key, value] of Object.entries(dict.el)) {
    if (allowedSame.includes(key) || /^(meta|alt)\./.test(key) === false && value.length < 4) continue;
    assert.match(value, /[\u0370-\u03FF]/, `el: ${key} enthält kein Griechisch: ${value}`);
  }
});

test("Deutsche Texte sind übersetzt, nicht nur kopiert", () => {
  const sameAllowed = new Set(["nav.wellness", "meta.well.title", "rooms.r3", "gallery.title", "menu.cat.desserts", "footer.rights", "meta.rest.title", "book.cat.any", "nav.restaurant", "well.spa.title", "well.pool.title"]);
  const identical = Object.keys(dict.en).filter((k) => dict.de[k] === dict.en[k] && !sameAllowed.has(k));
  assert.deepEqual(identical, [], "Diese deutschen Texte sind identisch mit Englisch");
});

test("Jeder in HTML und JavaScript benutzte Schlüssel existiert", () => {
  const known = new Set(Object.keys(dict.en));
  const jsFiles = fs.readdirSync(path.join(ROOT, "js")).filter((f) => f.endsWith(".js")).map((f) => read("js", f));
  const sources = [...pages.map((f) => [f, read(f)]), ...jsFiles.map((s, i) => ["js#" + i, s])];
  const missing = [];
  for (const [name, text] of sources) {
    const used = [
      ...[...text.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]),
      ...[...text.matchAll(/data-(?:title|desc)-key="([^"]+)"/g)].map((m) => m[1]),
      ...[...text.matchAll(/data-i18n-attr="([^"]+)"/g)].flatMap((m) => m[1].split(";").map((p) => p.split(":")[1]?.trim())),
      ...[...text.matchAll(/\bt\("([^"]+)"\)/g)].map((m) => m[1]),
      ...[...text.matchAll(/\bfill\("([^"]+)"/g)].map((m) => m[1]),
      ...[...text.matchAll(/"((?:book|res|rooms)\.err?\.?[A-Za-z.]+)"/g)].map((m) => m[1]),
    ].filter(Boolean);
    used.forEach((key) => { if (!known.has(key)) missing.push(`${name}: ${key}`); });
  }
  assert.deepEqual([...new Set(missing)], []);
});

test("Jedes Bild mit Alt-Text ist übersetzbar", () => {
  for (const page of pages) {
    const images = [...read(page).matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
    for (const tag of images) {
      if (/alt=""/.test(tag)) continue; // dekorative Bilder (z. B. Hero) brauchen keinen Text
      assert.match(tag, /data-i18n-attr="alt:alt\.\d+"/, `${page}: ${tag.slice(0, 90)}`);
    }
  }
});

test("Jede Seite hat Seitentitel und Beschreibung in allen Sprachen", () => {
  for (const page of pages.filter((p) => !["imprint.html", "privacy.html"].includes(p))) {
    const html = read(page);
    const title = html.match(/data-title-key="([^"]+)"/)?.[1];
    const desc = html.match(/data-desc-key="([^"]+)"/)?.[1];
    assert.ok(title && desc, `${page}: title-key/desc-key fehlt`);
    for (const lang of ["en", "de", "el"]) assert.ok(dict[lang][title] && dict[lang][desc], `${page}/${lang}`);
  }
});
