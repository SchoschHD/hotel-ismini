/* availabilityRoutes.js – Verfügbarkeit. Eingebunden in server.js unter /api/availability */
const express = require("express");
const { getAvailability } = require("../controllers/availabilityController");

const router = express.Router();
router.get("/", getAvailability);

module.exports = router;
