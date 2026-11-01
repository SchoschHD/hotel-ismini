/* booking.test.js – Prüft Buchungslogik, Doppelbuchungsschutz und Sicherheit. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { startTestServer, bookingPayload } = require("./helpers");

const countBookings = (db) => db.prepare("SELECT COUNT(*) AS n FROM bookings").get().n;

test("Buchung: 201, Buchungsnummer, Preis aus der Datenbank", async (t) => {
  const s = await startTestServer(); t.after(s.close);
  const res = await s.post("/api/bookings", bookingPayload());
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.match(data.bookingNumber, /^ISM-\d{4}-[A-HJ-NP-Z2-9]{6}$/);
  assert.equal(data.totalPrice, 3 * 12000);
  assert.equal(data.status, "confirmed");
  assert.equal(countBookings(s.db), 1);
});

test("Manipulierter Preis aus dem Browser wird ignoriert", async (t) => {
  const s = await startTestServer(); t.after(s.close);
  const res = await s.post("/api/bookings", bookingPayload({ totalPrice: 1, pricePerNight: 1, total: 1, total_cents: 1 }));
  assert.equal(res.status, 201);
  assert.equal((await res.json()).totalPrice, 36000);
  assert.equal(s.db.prepare("SELECT total_cents FROM bookings").get().total_cents, 36000);
});

test("Ungültige Buchung wird abgelehnt und nicht gespeichert", async (t) => {
  const s = await startTestServer(); t.after(s.close);
  const bad = [
    { email: "kein-email" }, { firstName: "" }, { lastName: "   " }, { roomId: 999 }, { roomId: "abc" },
    { checkOut: "2031-06-10" }, { checkIn: "2020-01-01", checkOut: "2020-01-02" },
    { adults: 3 },                       // Garden Room fasst nur 2
    { phone: "<script>" }, { notes: "x".repeat(501) },
  ];
  for (const change of bad) {
    const res = await s.post("/api/bookings", bookingPayload(change));
    assert.equal(res.status, 422, JSON.stringify(change));
  }
  assert.equal(countBookings(s.db), 0);
});

test("Doppelbuchung: gleichzeitige Anfragen für das letzte Zimmer", async (t) => {
  const s = await startTestServer(); t.after(s.close);
  // Suite hat 2 Zimmer. Fünf Gäste buchen gleichzeitig, nur zwei dürfen Erfolg haben.
  const results = await Promise.all(
    Array.from({ length: 5 }, (_, i) => s.post("/api/bookings", bookingPayload({ roomId: 3, adults: 3, email: `gast${i}@example.com` })))
  );
  const statuses = results.map((r) => r.status).sort();
  assert.deepEqual(statuses, [201, 201, 409, 409, 409]);
  assert.equal(countBookings(s.db), 2);
});

test("Bei Konflikt (409) wird nichts gespeichert", async (t) => {
  const s = await startTestServer(); t.after(s.close);
  s.db.prepare("UPDATE room_types SET units = 1 WHERE id = 1").run();
  assert.equal((await s.post("/api/bookings", bookingPayload())).status, 201);
  const second = await s.post("/api/bookings", bookingPayload({ checkIn: "2031-06-11", checkOut: "2031-06-12" }));
  assert.equal(second.status, 409);
  assert.equal(countBookings(s.db), 1);
});

test("Zwei Zimmer in einer Buchung zählen doppelt", async (t) => {
  const s = await startTestServer(); t.after(s.close);
  s.db.prepare("UPDATE room_types SET units = 3 WHERE id = 1").run();
  assert.equal((await s.post("/api/bookings", bookingPayload({ rooms: 2, adults: 4 }))).status, 201);
  assert.equal((await s.post("/api/bookings", bookingPayload({ rooms: 2, adults: 4 }))).status, 409); // nur noch 1 frei
  assert.equal((await s.post("/api/bookings", bookingPayload({ rooms: 1 }))).status, 201);
});

test("Buchungsnummern sind eindeutig", async (t) => {
  const s = await startTestServer({ bookingGlobalRateLimitMax: 100, bookingEmailRateLimitMax: 100 }); t.after(s.close);
  s.db.prepare("UPDATE room_types SET units = 50 WHERE id = 1").run();
  const numbers = new Set();
  for (let i = 0; i < 25; i++) numbers.add((await (await s.post("/api/bookings", bookingPayload())).json()).bookingNumber);
  assert.equal(numbers.size, 25);
});

test("SQL-Injection: Eingaben werden nur als Text gespeichert", async (t) => {
  const s = await startTestServer(); t.after(s.close);
  const evil = "x'); DROP TABLE bookings; --";
  const res = await s.post("/api/bookings", bookingPayload({ firstName: evil, notes: evil }));
  assert.equal(res.status, 201);
  assert.equal(s.db.prepare("SELECT first_name FROM bookings").get().first_name, evil);
  assert.equal(countBookings(s.db), 1); // Tabelle existiert noch
});

test("Kaputtes JSON gibt 400, unbekannte API-Pfade 404", async (t) => {
  const s = await startTestServer(); t.after(s.close);
  assert.equal((await s.post("/api/bookings", "{kein json")).status, 400);
  assert.equal((await s.get("/api/gibt-es-nicht")).status, 404);
});

test("Restaurantanfrage: gültig = 201, ungültig = 422", async (t) => {
  const s = await startTestServer(); t.after(s.close);
  const ok = { name: "Anna Test", email: "anna@example.com", phone: "", guests: 2, date: "2031-06-10", time: "20:00", notes: "", language: "el" };
  assert.equal((await s.post("/api/restaurant-requests", ok)).status, 201);
  assert.equal(s.db.prepare("SELECT COUNT(*) AS n FROM restaurant_requests").get().n, 1);
  for (const change of [{ email: "x" }, { guests: 0 }, { guests: 13 }, { date: "2020-01-01" }, { time: "25:99" }, { name: "A" }]) {
    assert.equal((await s.post("/api/restaurant-requests", { ...ok, ...change })).status, 422, JSON.stringify(change));
  }
});

test("Webserver gibt keine internen Dateien heraus", async (t) => {
  const s = await startTestServer(); t.after(s.close);
  assert.equal((await s.get("/")).status, 200);
  assert.equal((await s.get("/booking.html")).status, 200);
  for (const path of ["/.env", "/package.json", "/backend/server.js", "/backend/database/ismini.db", "/tests/helpers.js", "/node_modules/express/package.json", "/css/../package.json"]) {
    assert.notEqual((await s.get(path)).status, 200, path);
  }
  const headers = (await s.get("/")).headers;
  assert.match(headers.get("content-security-policy"), /default-src 'self'/);
  assert.equal(headers.get("x-powered-by"), null);
});

test("Rate-Limit schützt Schreib-Endpunkte", async (t) => {
  const s = await startTestServer({ rateLimitMax: 3, bookingRateLimitMax: 3 }); t.after(s.close);
  const statuses = [];
  for (let i = 0; i < 5; i++) statuses.push((await s.post("/api/bookings", bookingPayload({ roomId: 999 }))).status);
  assert.equal(statuses.at(-1), 429);
});

test("Buchungen mit derselben E-Mail werden pro Minute begrenzt", async (t) => {
  const s = await startTestServer({ bookingEmailRateLimitMax: 2 }); t.after(s.close);
  s.db.prepare("UPDATE room_types SET units = 10 WHERE id = 1").run();
  assert.equal((await s.post("/api/bookings", bookingPayload())).status, 201);
  assert.equal((await s.post("/api/bookings", bookingPayload({ checkIn: "2031-06-11", checkOut: "2031-06-12" }))).status, 201);
  const blocked = await s.post("/api/bookings", bookingPayload({ checkIn: "2031-06-12", checkOut: "2031-06-13" }));
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json()).error, "too_many_requests");
  assert.equal(countBookings(s.db), 2);
});

test("Buchungen werden global pro Minute begrenzt", async (t) => {
  const s = await startTestServer({ bookingGlobalRateLimitMax: 2 }); t.after(s.close);
  s.db.prepare("UPDATE room_types SET units = 10 WHERE id = 1").run();
  assert.equal((await s.post("/api/bookings", bookingPayload({ email: "one@example.com" }))).status, 201);
  assert.equal((await s.post("/api/bookings", bookingPayload({ email: "two@example.com", checkIn: "2031-06-11", checkOut: "2031-06-12" }))).status, 201);
  assert.equal((await s.post("/api/bookings", bookingPayload({ email: "three@example.com", checkIn: "2031-06-12", checkOut: "2031-06-13" }))).status, 429);
  assert.equal(countBookings(s.db), 2);
});
