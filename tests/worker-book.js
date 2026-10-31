/* worker-book.js – Hilfsprogramm für concurrency.test.js.
   Öffnet dieselbe Datenbankdatei wie die anderen Prozesse, wartet bis zur
   gemeinsamen Startzeit und versucht dann, die letzte Suite zu buchen. */
const { openDatabase } = require("../backend/database/database");
const { createBooking } = require("../backend/services/bookingService");

const [dbPath, startAt, index] = process.argv.slice(2);
const db = openDatabase(dbPath);
while (Date.now() < Number(startAt)) { /* alle Prozesse starten im selben Moment */ }

try {
  createBooking(db, {
    roomId: 3, checkIn: "2031-06-10", checkOut: "2031-06-13", adults: 3, children: 0, rooms: 1,
    firstName: "Gast", lastName: String(index), email: `gast${index}@example.com`, language: "en",
  });
  console.log("OK");
} catch (error) {
  console.log(error.name === "ConflictError" ? "CONFLICT" : "ERROR " + error.message);
}
