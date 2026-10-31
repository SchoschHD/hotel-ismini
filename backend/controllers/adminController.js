const { ValidationError } = require("../services/errors");
const v = require("../services/validation");

function listData(req, res) {
  const db = req.app.locals.db;
  const bookings = db.prepare(`
    SELECT b.id, b.booking_number AS bookingNumber, r.slug AS roomSlug, r.name AS roomName,
      b.check_in AS checkIn, b.check_out AS checkOut, b.nights, b.rooms, b.adults, b.children,
      b.total_cents AS totalCents, b.currency, b.first_name AS firstName, b.last_name AS lastName,
      b.email, b.phone, b.notes, b.language, b.status, b.created_at AS createdAt
    FROM bookings b JOIN room_types r ON r.id = b.room_type_id ORDER BY b.created_at DESC
  `).all();
  const restaurantRequests = db.prepare(`
    SELECT id, name, email, phone, guests, date, time, notes, language, created_at AS createdAt
    FROM restaurant_requests ORDER BY created_at DESC
  `).all();
  const rooms = db.prepare(`
    SELECT id, slug, name, max_guests AS maxGuests, units,
      price_per_night_cents AS pricePerNightCents, currency, is_sample AS isSample, active
    FROM room_types ORDER BY id
  `).all();
  res.json({ bookings, restaurantRequests, rooms });
}

function cancelBooking(req, res) {
  const id = v.toInteger(req.params.id);
  if (!(id >= 1)) throw new ValidationError({ id: "invalid" });
  const result = req.app.locals.db.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ? AND status = 'confirmed'").run(id);
  if (!result.changes) return res.status(404).json({ error: "booking_not_found_or_cancelled" });
  res.status(204).end();
}

function updateRoom(req, res) {
  const id = v.toInteger(req.params.id);
  const body = req.body || {};
  const name = v.cleanText(body.name);
  const maxGuests = v.toInteger(body.maxGuests);
  const units = v.toInteger(body.units);
  const pricePerNightCents = v.toInteger(body.pricePerNightCents);
  if (!(id >= 1) || !name || name.length > 120 || !(maxGuests >= 1 && maxGuests <= 12) || !(units >= 0 && units <= 100) || !(pricePerNightCents >= 0 && pricePerNightCents <= 100000000)) {
    throw new ValidationError({ room: "invalid" });
  }
  const result = req.app.locals.db.prepare(`
    UPDATE room_types SET name = ?, max_guests = ?, units = ?, price_per_night_cents = ?, is_sample = 0
    WHERE id = ?
  `).run(name, maxGuests, units, pricePerNightCents, id);
  if (!result.changes) return res.status(404).json({ error: "room_not_found" });
  res.status(204).end();
}

module.exports = { listData, cancelBooking, updateRoom };
