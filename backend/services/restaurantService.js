/* ==========================================================
   restaurantService.js – Anfragen ans Restaurant speichern.
   Eine Anfrage ist KEINE bestätigte Reservierung.
   Verwendet von: controllers/restaurantController.js
   ========================================================== */
const { ValidationError } = require("./errors");
const v = require("./validation");

function createRestaurantRequest(db, input, today = v.todayInAthens()) {
  const errors = {};
  const name = v.cleanText(input.name);
  const email = v.cleanText(input.email);
  const phone = v.cleanText(input.phone);
  const notes = v.cleanText(input.notes, { multiline: true });
  const guests = v.toInteger(input.guests);
  const date = typeof input.date === "string" ? input.date : "";
  const time = typeof input.time === "string" ? input.time : "";

  if (name.length < 2 || name.length > 80) errors.name = "invalid";
  if (!v.isEmail(email)) errors.email = "invalid";
  if (phone && !/^[0-9+()\-\s.]{3,40}$/.test(phone)) errors.phone = "invalid";
  if (!(guests >= 1 && guests <= 12)) errors.guests = "out_of_range";
  if (!v.isValidDate(date) || date < today) errors.date = "invalid_date";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) errors.time = "invalid_time";
  if (notes.length > 500) errors.notes = "too_long";
  if (Object.keys(errors).length) throw new ValidationError(errors);

  const result = db.prepare(`
    INSERT INTO restaurant_requests (name, email, phone, guests, date, time, notes, language)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, email, phone || null, guests, date, time, notes || null, v.cleanLanguage(input.language));

  return { id: Number(result.lastInsertRowid) };
}

module.exports = { createRestaurantRequest };
