/* bookingController.js – POST /api/bookings
   Antwortet nur mit 201, wenn die Buchung wirklich in der Datenbank gespeichert wurde. */
const bookingService = require("../services/bookingService");

function createBooking(req, res) {
  const booking = bookingService.createBooking(req.app.locals.db, req.body || {});
  res.status(201).json(booking);
}

module.exports = { createBooking };
