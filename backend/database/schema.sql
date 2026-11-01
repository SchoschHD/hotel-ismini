-- ==========================================================
-- schema.sql – Datenbankschema für Hotel Ismini
-- Wird beim Start automatisch ausgeführt (CREATE ... IF NOT EXISTS).
-- Für PostgreSQL später: INTEGER PRIMARY KEY AUTOINCREMENT -> SERIAL,
-- datetime('now') -> now(). Die Tabellenstruktur bleibt gleich.
-- ==========================================================

-- Zimmertypen mit Anzahl der vorhandenen Zimmer ("units").
-- Preise stehen in Cent, damit keine Rundungsfehler entstehen.
CREATE TABLE IF NOT EXISTS room_types (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  slug                  TEXT    NOT NULL UNIQUE,
  name                  TEXT    NOT NULL,
  max_guests            INTEGER NOT NULL CHECK (max_guests BETWEEN 1 AND 12),
  units                 INTEGER NOT NULL CHECK (units >= 0),
  price_per_night_cents INTEGER NOT NULL CHECK (price_per_night_cents >= 0),
  currency              TEXT    NOT NULL DEFAULT 'EUR',
  is_sample             INTEGER NOT NULL DEFAULT 1,   -- 1 = Beispieldaten, bis das Hotel echte Werte liefert
  active                INTEGER NOT NULL DEFAULT 1
);

-- Buchungen. Datumsfelder sind reine Kalendertage (YYYY-MM-DD, Zeitzone Europe/Athens).
-- check_out ist der Abreisetag: In der Nacht davor ist das Zimmer belegt, am Abreisetag wieder frei.
CREATE TABLE IF NOT EXISTS bookings (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_number TEXT    NOT NULL UNIQUE,
  room_type_id   INTEGER NOT NULL REFERENCES room_types(id),
  check_in       TEXT    NOT NULL,
  check_out      TEXT    NOT NULL,
  nights         INTEGER NOT NULL CHECK (nights >= 1),
  rooms          INTEGER NOT NULL CHECK (rooms >= 1),
  adults         INTEGER NOT NULL CHECK (adults >= 1),
  children       INTEGER NOT NULL DEFAULT 0 CHECK (children >= 0),
  total_cents    INTEGER NOT NULL CHECK (total_cents >= 0),
  currency       TEXT    NOT NULL,
  first_name     TEXT    NOT NULL,
  last_name      TEXT    NOT NULL,
  email          TEXT    NOT NULL,
  phone          TEXT,
  notes          TEXT,
  language       TEXT    NOT NULL DEFAULT 'en',
  status         TEXT    NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  CHECK (check_out > check_in)
);
CREATE INDEX IF NOT EXISTS idx_bookings_overlap ON bookings (room_type_id, status, check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_bookings_email_created ON bookings (email, status, created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_status_created ON bookings (status, created_at);

-- Anfragen an das Restaurant (noch keine bestätigten Reservierungen).
CREATE TABLE IF NOT EXISTS restaurant_requests (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  email      TEXT    NOT NULL,
  phone      TEXT,
  guests     INTEGER NOT NULL CHECK (guests BETWEEN 1 AND 12),
  date       TEXT    NOT NULL,
  time       TEXT    NOT NULL,
  notes      TEXT,
  language   TEXT    NOT NULL DEFAULT 'en',
  status     TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
