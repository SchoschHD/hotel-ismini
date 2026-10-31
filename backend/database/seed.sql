-- ==========================================================
-- seed.sql – BEISPIELDATEN (werden nur eingefügt, wenn room_types leer ist)
-- Alle Zimmer und Preise sind erfunden und mit is_sample = 1 markiert.
-- Echte Werte: siehe README, Abschnitt "Zimmer und Preise ändern".
-- Preise in Cent: 12000 = 120,00 EUR pro Nacht.
-- ==========================================================
INSERT INTO room_types (slug, name, max_guests, units, price_per_night_cents, currency, is_sample) VALUES
  ('garden', 'Garden Room',   2, 4, 12000, 'EUR', 1),
  ('sea',    'Sea View Room', 2, 4, 16000, 'EUR', 1),
  ('suite',  'Aegean Suite',  4, 2, 26000, 'EUR', 1);
