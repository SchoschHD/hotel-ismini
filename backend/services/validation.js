/* ==========================================================
   validation.js – Gemeinsame Prüfungen für alle Eingaben.
   Alle Funktionen sind rein (ohne Datenbank) und leicht testbar.
   Verwendet von: bookingService.js, restaurantService.js
   ========================================================== */

/** Heutiges Datum in Athen als YYYY-MM-DD (Zeitzone Europe/Athens). */
function todayInAthens(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(now);
}

/** Prüft YYYY-MM-DD streng, inklusive echter Kalendertage (kein 2030-02-31). */
function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Anzahl Tage zwischen zwei Kalendertagen (rechnet in UTC, daher ohne Sommerzeit-Fehler). */
function daysBetween(from, to) {
  return Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86400000);
}

/** Liefert den Kalendertag + n Tage. */
function addDays(isoDate, days) {
  const date = new Date(isoDate + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Wandelt Text oder Zahl in eine ganze Zahl um, sonst NaN. Leerer Text ist ungültig. */
function toInteger(value) {
  if (typeof value === "number") return Number.isInteger(value) ? value : NaN;
  if (typeof value === "string" && /^\d{1,4}$/.test(value.trim())) return Number(value.trim());
  return NaN;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const isEmail = (value) => typeof value === "string" && value.length <= 254 && EMAIL_PATTERN.test(value);

/** Entfernt Steuerzeichen und trimmt. Zeilenumbrüche bleiben optional erhalten. */
function cleanText(value, { multiline = false } = {}) {
  if (typeof value !== "string") return "";
  const pattern = multiline ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g;
  return value.replace(pattern, "").trim();
}

const SUPPORTED_LANGUAGES = ["en", "de", "el"];
const cleanLanguage = (value) => (SUPPORTED_LANGUAGES.includes(value) ? value : "en");

module.exports = { todayInAthens, isValidDate, daysBetween, addDays, toInteger, isEmail, cleanText, cleanLanguage };
