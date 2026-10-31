/* ==========================================================
   bookingService.js – Verfügbarkeit, Preis und Buchung.

   Regeln:
   - Preise und Verfügbarkeit werden NUR hier berechnet, nie im Browser.
   - Der Preis kommt aus der Datenbank. Preise aus dem Browser werden ignoriert.
   - Eine Buchung wird in einer Transaktion mit Sperre (BEGIN IMMEDIATE)
     geprüft und gespeichert. So können zwei gleichzeitige Anfragen
     nicht dasselbe letzte Zimmer bekommen.
   - Am Abreisetag ist das Zimmer wieder frei (Anreise am selben Tag erlaubt).
   Verwendet von: controllers/availabilityController.js, controllers/bookingController.js
   ========================================================== */
const crypto = require("node:crypto");
const { ValidationError, ConflictError } = require("./errors");
const v = require("./validation");

const LIMITS = { maxNights: 30, maxAdults: 10, maxChildren: 10, maxRooms: 5 };

/**
 * Prüft Aufenthaltsdaten und gibt bereinigte Werte zurück.
 * Wirft ValidationError mit Feld -> Fehlercode.
 */
function parseStay(input, today = v.todayInAthens()) {
  const errors = {};
  const checkIn = typeof input.checkIn === "string" ? input.checkIn : "";
  const checkOut = typeof input.checkOut === "string" ? input.checkOut : "";
  const adults = v.toInteger(input.adults);
  const children = input.children === undefined || input.children === "" ? 0 : v.toInteger(input.children);
  const rooms = input.rooms === undefined || input.rooms === "" ? 1 : v.toInteger(input.rooms);

  if (!v.isValidDate(checkIn)) errors.checkIn = "invalid_date";
  else if (checkIn < today) errors.checkIn = "in_the_past";

  if (!v.isValidDate(checkOut)) errors.checkOut = "invalid_date";
  else if (!errors.checkIn && checkOut <= checkIn) errors.checkOut = "before_check_in";
  else if (!errors.checkIn && v.daysBetween(checkIn, checkOut) > LIMITS.maxNights) errors.checkOut = "stay_too_long";

  if (!(adults >= 1 && adults <= LIMITS.maxAdults)) errors.adults = "out_of_range";
  if (!(children >= 0 && children <= LIMITS.maxChildren)) errors.children = "out_of_range";
  if (!(rooms >= 1 && rooms <= LIMITS.maxRooms)) errors.rooms = "out_of_range";

  if (Object.keys(errors).length) throw new ValidationError(errors);
  return { checkIn, checkOut, nights: v.daysBetween(checkIn, checkOut), adults, children, rooms };
}

/**
 * Höchste Zahl gleichzeitig belegter Zimmer dieses Typs in einer Nacht des Zeitraums.
 * Es wird Nacht für Nacht gezählt, damit sich Buchungen, die sich nur teilweise
 * überschneiden, nicht fälschlich addieren.
 */
function peakOccupancy(db, roomTypeId, checkIn, checkOut) {
  const overlapping = db.prepare(`
    SELECT check_in, check_out, rooms FROM bookings
    WHERE room_type_id = ? AND status = 'confirmed' AND check_in < ? AND check_out > ?
  `).all(roomTypeId, checkOut, checkIn);

  let peak = 0;
  for (let night = checkIn; night < checkOut; night = v.addDays(night, 1)) {
    const booked = overlapping
      .filter((b) => b.check_in <= night && b.check_out > night)
      .reduce((sum, b) => sum + b.rooms, 0);
    peak = Math.max(peak, booked);
  }
  return peak;
}

const fitsGuests = (room, stay) => stay.adults + stay.children <= room.max_guests * stay.rooms;
const totalPrice = (room, stay) => room.price_per_night_cents * stay.nights * stay.rooms;

/** Liefert alle Zimmertypen, die für den Aufenthalt frei sind, inklusive Preis. */
function getAvailability(db, query, today) {
  const stay = parseStay(query, today);
  const category = typeof query.category === "string" && query.category ? query.category : null;

  const roomTypes = category
    ? db.prepare("SELECT * FROM room_types WHERE active = 1 AND slug = ?").all(category)
    : db.prepare("SELECT * FROM room_types WHERE active = 1 ORDER BY price_per_night_cents").all();

  const rooms = roomTypes
    .filter((room) => fitsGuests(room, stay))
    .filter((room) => room.units - peakOccupancy(db, room.id, stay.checkIn, stay.checkOut) >= stay.rooms)
    .map((room) => ({
      id: room.id,
      slug: room.slug,
      name: room.name,
      maxGuests: room.max_guests,
      pricePerNight: room.price_per_night_cents,
      totalPrice: totalPrice(room, stay),
      currency: room.currency,
      isSample: Boolean(room.is_sample),
    }));

  return { checkIn: stay.checkIn, checkOut: stay.checkOut, nights: stay.nights, rooms };
}

const NUMBER_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // ohne leicht verwechselbare Zeichen (0/O, 1/I)
function newBookingNumber(today) {
  const suffix = Array.from({ length: 6 }, () => NUMBER_ALPHABET[crypto.randomInt(NUMBER_ALPHABET.length)]).join("");
  return `ISM-${today.slice(0, 4)}-${suffix}`;
}

/** Prüft die Kontaktdaten des Gastes. */
function parseGuest(input) {
  const errors = {};
  const firstName = v.cleanText(input.firstName);
  const lastName = v.cleanText(input.lastName);
  const email = v.cleanText(input.email);
  const phone = v.cleanText(input.phone);
  const notes = v.cleanText(input.notes, { multiline: true });

  if (!firstName || firstName.length > 80) errors.firstName = "invalid";
  if (!lastName || lastName.length > 80) errors.lastName = "invalid";
  if (!v.isEmail(email)) errors.email = "invalid";
  if (phone && !/^[0-9+()\-\s.]{3,40}$/.test(phone)) errors.phone = "invalid";
  if (notes.length > 500) errors.notes = "too_long";

  if (Object.keys(errors).length) throw new ValidationError(errors);
  return { firstName, lastName, email, phone: phone || null, notes: notes || null, language: v.cleanLanguage(input.language) };
}

/**
 * Legt eine Buchung an. Alles passiert in EINER Transaktion:
 * Zimmer lesen, Belegung prüfen, Preis berechnen, speichern.
 * Gibt die gespeicherte Buchung zurück oder wirft ValidationError / ConflictError.
 */
function createBooking(db, input, today = v.todayInAthens()) {
  const stay = parseStay(input, today);
  const guest = parseGuest(input);
  const roomId = v.toInteger(input.roomId);
  if (!(roomId >= 1)) throw new ValidationError({ roomId: "invalid" });

  const insert = db.prepare(`
    INSERT INTO bookings (booking_number, room_type_id, check_in, check_out, nights, rooms, adults, children,
                          total_cents, currency, first_name, last_name, email, phone, notes, language)
    VALUES (@bookingNumber, @roomTypeId, @checkIn, @checkOut, @nights, @rooms, @adults, @children,
            @total, @currency, @firstName, @lastName, @email, @phone, @notes, @language)
  `);

  const save = db.transaction(() => {
    const room = db.prepare("SELECT * FROM room_types WHERE id = ? AND active = 1").get(roomId);
    if (!room) throw new ValidationError({ roomId: "unknown_room" });
    if (!fitsGuests(room, stay)) throw new ValidationError({ adults: "too_many_guests" });

    const free = room.units - peakOccupancy(db, room.id, stay.checkIn, stay.checkOut);
    if (free < stay.rooms) throw new ConflictError();

    const total = totalPrice(room, stay); // Preis immer aus der Datenbank
    for (let attempt = 0; attempt < 5; attempt++) {
      const bookingNumber = newBookingNumber(today);
      try {
        insert.run({ bookingNumber, roomTypeId: room.id, ...stay, total, currency: room.currency, ...guest });
        return { bookingNumber, roomSlug: room.slug, roomName: room.name, ...stay, totalPrice: total, currency: room.currency, status: "confirmed" };
      } catch (error) {
        if (error.code !== "SQLITE_CONSTRAINT_UNIQUE") throw error; // nur bei doppelter Nummer neu würfeln
      }
    }
    throw new Error("Could not generate a unique booking number");
  });

  // immediate(): sperrt die Datenbank zum Schreiben, bevor geprüft wird
  return save.immediate();
}

module.exports = { parseStay, getAvailability, createBooking, peakOccupancy, LIMITS };
