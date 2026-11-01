/* bookingController.js – POST /api/bookings
   Antwortet nur mit 201, wenn die Buchung wirklich in der Datenbank gespeichert wurde. */
const bookingService = require("../services/bookingService");
const { sendBookingEmails } = require("../services/emailService");

async function createBooking(req, res, next) {
  try {
    const booking = bookingService.createBooking(
      req.app.locals.db,
      req.body || {},
      undefined,
      req.app.locals.bookingLimits
    );
    const email = await sendBookingEmails({ ...booking, ...req.body, email: req.body?.email });
    res.status(201).json({ ...booking, ...email });
  } catch (error) {
    next(error);
  }
}

module.exports = { createBooking };
