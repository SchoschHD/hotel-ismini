/* concurrency.test.js – Doppelbuchungsschutz über mehrere Prozesse.
   Sechs getrennte Node-Prozesse buchen gleichzeitig die zwei vorhandenen Suiten.
   Der Schutz kommt von BEGIN IMMEDIATE in bookingService.js. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { openDatabase } = require("../backend/database/database");

const run = (args) => new Promise((resolve) => {
  execFile(process.execPath, [path.join(__dirname, "worker-book.js"), ...args], (err, stdout, stderr) => resolve((stdout + stderr).trim()));
});

test("Mehrere Prozesse: höchstens so viele Buchungen wie Zimmer", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ismini-"));
  const dbPath = path.join(dir, "test.db");
  openDatabase(dbPath).close(); // Schema und Beispieldaten anlegen (Suite: 2 Zimmer)
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const startAt = Date.now() + 1500;
  const outputs = await Promise.all(Array.from({ length: 6 }, (_, i) => run([dbPath, String(startAt), String(i)])));

  assert.equal(outputs.filter((o) => o === "OK").length, 2, outputs.join(" | "));
  assert.equal(outputs.filter((o) => o === "CONFLICT").length, 4, outputs.join(" | "));

  const db = openDatabase(dbPath);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM bookings").get().n, 2);
  db.close();
});
