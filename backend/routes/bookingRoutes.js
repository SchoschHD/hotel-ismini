/* bookingRoutes.js – Buchungen und Restaurantanfragen.
   Eingebunden in server.js unter /api */
const express = require("express");
const { createBooking } = require("../controllers/bookingController");
const { createRequest } = require("../controllers/restaurantController");

const router = express.Router();
router.post("/bookings", createBooking);
router.post("/restaurant-requests", createRequest);

module.exports = router;
