/* availabilityController.js – GET /api/availability
   Nimmt die Anfrage entgegen und ruft den Service auf. Fehler gehen an errorHandler.js. */
const bookingService = require("../services/bookingService");

function getAvailability(req, res) {
  const result = bookingService.getAvailability(req.app.locals.db, req.query);
  res.json(result);
}

module.exports = { getAvailability };
