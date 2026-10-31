/* restaurantController.js – POST /api/restaurant-requests
   Speichert eine Anfrage (keine bestätigte Reservierung). */
const restaurantService = require("../services/restaurantService");

function createRequest(req, res) {
  const saved = restaurantService.createRestaurantRequest(req.app.locals.db, req.body || {});
  res.status(201).json({ received: true, id: saved.id });
}

module.exports = { createRequest };
