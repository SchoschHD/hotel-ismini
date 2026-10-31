/* availability.test.js – Prüft Verfügbarkeit, Preisberechnung und Datumslogik. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { startTestServer, bookingPayload, query } = require("./helpers");
const { isValidDate, addDays, daysBetween, todayInAthens } = require("../backend/services/validation");

const stay = { checkIn: "2031-06-10", checkOut: "2031-06-13", adults: 2, children: 0, rooms: 1 };

test("Datumslogik: echte Kalendertage, Sommerzeit-sicher", () => {
  assert.equal(isValidDate("2031-06-10"), true);
  assert.equal(isValidDate("2031-02-31"), false);
  assert.equal(isValidDate("10.06.2031"), false);
  assert.equal(isValidDate(""), false);
  // Sommerzeit in Griechenland beginnt am 30.03.2031. Es muss trotzdem exakt 2 Tage ergeben.
  assert.equal(addDays("2031-03-29", 2), "2031-03-31");
  assert.equal(daysBetween("2031-03-29", "2031-03-31"), 2);
  assert.match(todayInAthens(), /^\d{4}-\d{2}-\d{2}$/);
});

test("Verfügbarkeit: liefert Zimmer mit Preis aus der Datenbank", async (t) => {
  const s = await startTestServer(); t.after(s.close);
  const res = await s.get("/api/availability" + query(stay));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.nights, 3);
  assert.equal(data.rooms.length, 3);
  const garden = data.rooms.find((r) => r.slug === "garden");
  assert.equal(garden.pricePerNight, 12000);
  assert.equal(garden.totalPrice, 3 * 12000);   // 3 Nächte x 120 EUR
  assert.equal(garden.isSample, true);
});

test("Preis: Nächte x Preis x Anzahl Zimmer", async (t) => {
  const s = await startTestServer(); t.after(s.close);
  const data = await (await s.get("/api/availability" + query({ ...stay, rooms: 2, adults: 4 }))).json();
  assert.equal(data.rooms.find((r) => r.slug === "sea").totalPrice, 3 * 16000 * 2);
});

test("Kapazität: 3 Gäste passen nur in die Suite", async (t) => {
  const s = await startTestServer(); t.after(s.close);
  const data = await (await s.get("/api/availability" + query({ ...stay, adults: 3 }))).json();
  assert.deepEqual(data.rooms.map((r) => r.slug), ["suite"]);
});

test("Kategorie-Filter", async (t) => {
  const s = await startTestServer(); t.after(s.close);
  const data = await (await s.get("/api/availability" + query({ ...stay, category: "sea" }))).json();
  assert.deepEqual(data.rooms.map((r) => r.slug), ["sea"]);
});

test("Ungültige Eingaben werden mit 422 abgelehnt", async (t) => {
  const s = await startTestServer(); t.after(s.close);
  const cases = [
    [{ checkOut: "2031-06-09" }, "checkOut"],        // Abreise vor Anreise
    [{ checkOut: stay.checkIn }, "checkOut"],        // 0 Nächte
    [{ checkIn: "2020-01-01", checkOut: "2020-01-03" }, "checkIn"], // Vergangenheit
    [{ checkIn: "2031-02-31" }, "checkIn"],          // gibt es nicht
    [{ checkOut: "2031-08-30" }, "checkOut"],        // mehr als 30 Nächte
    [{ adults: 0 }, "adults"],
    [{ adults: "abc" }, "adults"],
    [{ rooms: 9 }, "rooms"],
  ];
  for (const [change, field] of cases) {
    const res = await s.get("/api/availability" + query({ ...stay, ...change }));
    assert.equal(res.status, 422, JSON.stringify(change));
    assert.ok((await res.json()).errors[field], `Fehler für ${field} erwartet`);
  }
});

test("Abreisetag ist wieder frei (Anreise am selben Tag erlaubt)", async (t) => {
  const s = await startTestServer(); t.after(s.close);
  s.db.prepare("UPDATE room_types SET units = 1 WHERE slug = 'suite'").run();
  assert.equal((await s.post("/api/bookings", bookingPayload({ roomId: 3, adults: 3 }))).status, 201); // 10.-13.6.

  const same = await (await s.get("/api/availability" + query({ ...stay, adults: 3, checkIn: "2031-06-12", checkOut: "2031-06-14" }))).json();
  assert.equal(same.rooms.length, 0, "überschneidet sich: Suite belegt");

  const after = await (await s.get("/api/availability" + query({ ...stay, adults: 3, checkIn: "2031-06-13", checkOut: "2031-06-15" }))).json();
  assert.equal(after.rooms.length, 1, "am Abreisetag wieder frei");

  const before = await (await s.get("/api/availability" + query({ ...stay, adults: 3, checkIn: "2031-06-08", checkOut: "2031-06-10" }))).json();
  assert.equal(before.rooms.length, 1, "Abreise am Anreisetag der Buchung ist frei");
});

test("Belegt: ausgebuchter Zimmertyp wird nicht angeboten", async (t) => {
  const s = await startTestServer(); t.after(s.close);
  s.db.prepare("UPDATE room_types SET units = 1 WHERE slug = 'suite'").run();
  await s.post("/api/bookings", bookingPayload({ roomId: 3, adults: 3 }));
  const data = await (await s.get("/api/availability" + query({ ...stay, adults: 3 }))).json();
  assert.equal(data.rooms.length, 0);
});

test("Teilweise Überschneidung wird nicht doppelt gezählt", async (t) => {
  const s = await startTestServer(); t.after(s.close);
  // Suite hat 2 Zimmer. Zwei kurze Buchungen, die sich nicht überschneiden:
  await s.post("/api/bookings", bookingPayload({ roomId: 3, adults: 3, checkIn: "2031-06-01", checkOut: "2031-06-03" }));
  await s.post("/api/bookings", bookingPayload({ roomId: 3, adults: 3, checkIn: "2031-06-05", checkOut: "2031-06-07" }));
  // Pro Nacht ist höchstens 1 Suite belegt, also ist 1 Suite für den ganzen Zeitraum frei.
  const one = await (await s.get("/api/availability" + query({ checkIn: "2031-06-01", checkOut: "2031-06-07", adults: 3, rooms: 1 }))).json();
  assert.equal(one.rooms.length, 1);
  const two = await (await s.get("/api/availability" + query({ checkIn: "2031-06-01", checkOut: "2031-06-07", adults: 6, rooms: 2 }))).json();
  assert.equal(two.rooms.length, 0);
});
