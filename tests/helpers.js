/* helpers.js – Gemeinsame Hilfen für die Tests.
   Jeder Test bekommt eine frische In-Memory-Datenbank mit den Beispieldaten
   und einen echten HTTP-Server auf einem freien Port. */
const { openDatabase } = require("../backend/database/database");
const { createApp } = require("../backend/server");

async function startTestServer(options = {}) {
  const db = openDatabase(":memory:");
  const app = createApp(db, {
    rateLimitMax: 1000,
    bookingRateLimitMax: 1000,
    bookingGlobalRateLimitMax: 1000,
    bookingEmailRateLimitMax: 1000,
    emailEnabled: false,
    ...options,
  });
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;

  const get = (url) => fetch(base + url);
  const post = (url, body) => fetch(base + url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const close = () => new Promise((resolve) => { server.closeAllConnections?.(); server.close(resolve); db.close(); });
  return { db, base, get, post, close };
}

/** Gültige Buchungsdaten. Einzelne Felder lassen sich überschreiben. */
function bookingPayload(overrides = {}) {
  return {
    roomId: 1, checkIn: "2031-06-10", checkOut: "2031-06-13", adults: 2, children: 0, rooms: 1,
    firstName: "Anna", lastName: "Test", email: "anna@example.com", phone: "+30 210 1234567",
    notes: "", language: "de", ...overrides,
  };
}

const query = (params) => "?" + new URLSearchParams(params).toString();

module.exports = { startTestServer, bookingPayload, query };
