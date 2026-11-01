/* ==========================================================
   database.js – Öffnet die SQLite-Datenbank und legt Tabellen an.
   Verwendet von: server.js, tests/*.test.js
   ========================================================== */
const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

/**
 * Öffnet die Datenbank. ":memory:" nutzt eine Wegwerf-Datenbank (für Tests).
 * Beim ersten Start werden Schema und Beispieldaten geladen.
 */
function openDatabase(filePath = path.join(__dirname, "ismini.db"), { seed = true } = {}) {
  if (filePath !== ":memory:") fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");   // sicher bei gleichzeitigen Zugriffen
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");  // kurz warten, statt sofort zu scheitern

  db.exec(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));
  const requestColumns = db.prepare("PRAGMA table_info(restaurant_requests)").all();
  if (!requestColumns.some((column) => column.name === "status")) {
    db.exec("ALTER TABLE restaurant_requests ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'");
  }

  const roomCount = db.prepare("SELECT COUNT(*) AS n FROM room_types").get().n;
  if (seed && roomCount === 0) {
    db.exec(fs.readFileSync(path.join(__dirname, "seed.sql"), "utf8"));
  }
  return db;
}

module.exports = { openDatabase };
