const express = require("express");
const { listData, cancelBooking, updateRoom } = require("../controllers/adminController");
const { requireAdmin } = require("../middleware/adminAuth");

const router = express.Router();
router.use(requireAdmin);
router.get("/data", listData);
router.post("/bookings/:id/cancel", cancelBooking);
router.patch("/rooms/:id", updateRoom);

module.exports = router;
