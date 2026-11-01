const express = require("express");
const { listData, cancelBooking, deleteBooking, updateRestaurantRequestStatus, deleteRestaurantRequest, updateRoom } = require("../controllers/adminController");
const { requireAdmin } = require("../middleware/adminAuth");

const router = express.Router();
router.use(requireAdmin);
router.get("/data", listData);
router.post("/bookings/:id/cancel", cancelBooking);
router.delete("/bookings/:id", deleteBooking);
router.patch("/restaurant-requests/:id/status", updateRestaurantRequestStatus);
router.delete("/restaurant-requests/:id", deleteRestaurantRequest);
router.patch("/rooms/:id", updateRoom);

module.exports = router;
