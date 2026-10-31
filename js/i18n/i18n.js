/* ==========================================================
   i18n.js – Zentrale Sprachverwaltung (EN | DE | EL)
   Benutzung im HTML:
     data-i18n="schlüssel"                    -> ersetzt den Text
     data-i18n-attr="alt:schlüssel;aria-label:schlüssel" -> setzt Attribute
     <body data-title-key="..." data-desc-key="..."> -> Seitentitel/Meta
   Reihenfolge der Sprachwahl: ?lang=de, dann gespeicherte Wahl, dann Englisch.
   Die Wahl wird im localStorage gespeichert (technisch notwendig, siehe README).
   ========================================================== */
import en from "./en.js";
import de from "./de.js";
import el from "./el.js";

const dictionaries = { en, de, el };
const SUPPORTED = Object.keys(dictionaries);
const DEFAULT_LANG = "en";
const STORAGE_KEY = "ismini.lang";

let currentLang = DEFAULT_LANG;

/** Liest die gewünschte Sprache aus URL oder Speicher. */
function detectLanguage() {
  const fromUrl = new URLSearchParams(window.location.search).get("lang");
  if (SUPPORTED.includes(fromUrl)) return fromUrl;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (SUPPORTED.includes(saved)) return saved;
  } catch (e) { /* Speicher gesperrt: Standardsprache nutzen */ }
  return DEFAULT_LANG;
}

/** Übersetzt einen Schlüssel. Fehlt er, wird Englisch und zuletzt der Schlüssel gezeigt. */
export function t(key) {
  return dictionaries[currentLang][key] ?? dictionaries[DEFAULT_LANG][key] ?? key;
}

export function getLanguage() { return currentLang; }

/** Wendet die Texte auf die aktuelle Seite an. */
function applyTranslations() {
  document.documentElement.lang = currentLang;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });

  document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
    el.dataset.i18nAttr.split(";").forEach((pair) => {
      const [attr, key] = pair.split(":").map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    });
  });

  const { titleKey, descKey } = document.body.dataset;
  if (titleKey) document.title = t(titleKey);
  if (descKey) {
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", t(descKey));
  }

  // Sprachumschalter: aktuellen Button markieren
  document.querySelectorAll(".lang-switch button").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.lang === currentLang));
  });
}

/** Wechselt die Sprache sofort, ohne Seite neu zu laden. */
export function setLanguage(lang) {
  if (!SUPPORTED.includes(lang)) return;
  currentLang = lang;
  try { window.localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* ignorieren */ }

  // ?lang= in der Adresse aktuell halten, damit Links teilbar bleiben
  const url = new URL(window.location.href);
  url.searchParams.set("lang", lang);
  window.history.replaceState({}, "", url);

  applyTranslations();
  document.dispatchEvent(new CustomEvent("languagechange", { detail: { lang } }));
}

export function initI18n() {
  currentLang = detectLanguage();
  applyTranslations();
  document.querySelectorAll(".lang-switch button").forEach((btn) => {
    btn.addEventListener("click", () => setLanguage(btn.dataset.lang));
  });
}
