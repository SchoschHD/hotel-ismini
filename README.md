# Hotel Ismini

Responsive, multilingual hotel website with a Node.js/Express backend, SQLite demo database and server-side booking availability checks.

> **Demo status:** Room data, prices, contact details and images are sample content. The booking system stores demo data and does not take payments. Email notifications are available when SMTP settings are configured. Complete and legally review the content before production use.

## Requirements

- Node.js 20 or newer
- npm (included with Node.js)

## Installation

Open a terminal in the project folder:

```powershell
cd D:\Uni\VSCode\hotel-ismini
npm ci
```

## Configuration

Copy `.env.example` to `.env`:

```powershell
Copy-Item .env.example .env
```

Available settings are `PORT`, `DB_PATH`, `TRUST_PROXY`, `BOOKING_RATE_LIMIT_MAX`, `BOOKING_GLOBAL_RATE_LIMIT_MAX`, `BOOKING_EMAIL_RATE_LIMIT_MAX`, `ADMIN_PASSWORD` and the SMTP settings below. Never commit `.env` or database files.

The booking API has an IP-based limit (60 requests per 15 minutes by default),
a database-backed global limit (10 confirmed bookings per rolling minute by
default), and a database-backed limit per normalized email address (3 confirmed
bookings per rolling minute by default). These can be configured with
`BOOKING_RATE_LIMIT_MAX`, `BOOKING_GLOBAL_RATE_LIMIT_MAX` and
`BOOKING_EMAIL_RATE_LIMIT_MAX`. Keep these values conservative to prevent
automated booking and email spam; changing the SMTP password alone does not
replace these limits.

To send a confirmation to the guest and a notification to the hotel after a booking, fill in all SMTP settings:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
MAIL_FROM=Hotel Ismini <booking@example.com>
HOTEL_EMAIL=hotel@example.com
```

Use `SMTP_SECURE=true` for SMTP providers that require implicit TLS (usually port 465). If the SMTP settings are incomplete, bookings still work but the API returns `emailSent: false` and logs the reason.

## Start in VS Code

```powershell
npm start
```

Open [http://localhost:3000](http://localhost:3000). The database schema and sample room data are created automatically on first start.

For development with automatic server restarts:

```powershell
npm run dev
```

Stop the server with `Ctrl+C`.

If you open the HTML files through VS Code Live Server or another local preview
(for example on port 5500), start the backend with `npm start` as well. The
booking page automatically uses `http://localhost:3000/api` in that setup.
Opening the page without the backend cannot perform availability checks or save
bookings.

## Tests

```powershell
npm test
```

The suite covers booking dates and prices, server-side validation, concurrent booking protection, SQL-injection handling, API security, rate limiting, translations and image processing.

## Images

Place original JPG, PNG or WebP photos in `images-src/` using the names and folders listed in [images/IMAGE-LIST.md](images/IMAGE-LIST.md). Then run:

```powershell
npm run images
```

This creates AVIF and WebP variants in `images/` and updates the HTML `<picture>` elements. Without an original photo, the SVG placeholder remains.

## Room data and prices

Demo room types and prices are defined in [backend/database/seed.sql](backend/database/seed.sql). Seed data is inserted only when the `room_types` table is empty. For a fresh demo database, stop the server and remove the specific local database files:

```powershell
Remove-Item backend\database\ismini.db, backend\database\ismini.db-shm, backend\database\ismini.db-wal -ErrorAction SilentlyContinue
```

Do not delete a production database without a verified backup and migration plan.

## Project structure

- Main pages: `index.html`, `rooms.html`, `experiences.html`, `restaurant.html`, `wellness.html`, `booking.html`
- Legal page drafts: `imprint.html`, `privacy.html`
- `css/`: modular styles and design tokens
- `js/`: navigation, animations, galleries, booking, translations and consent
- `backend/`: Express server, API routes, services and SQLite database
- `tests/`: automated tests
- `tools/`: image processing pipeline
- `images-src/`: local source photos; not served by the webserver
- `MASTER-PROMPT.md`: original project requirements

## API

- `GET /api/availability` - checks available room types and server-calculated prices
- `POST /api/bookings` - validates and stores a demo booking; sends two emails when SMTP is configured
- `POST /api/restaurant-requests` - stores a restaurant request

The admin area is available at `/admin.html` after setting `ADMIN_PASSWORD`. It lists bookings and restaurant requests, supports search and refresh, can cancel a booking (including a cancellation email to the guest), and can permanently delete a booking. The confirmation and cancellation emails include styled HTML and plain-text content in `backend/services/emailService.js`.

Prices and availability are never trusted from the browser. The server validates booking input and prevents overlapping bookings in a transaction.

## Before production

1. Replace sample hotel data and SVG placeholders.
2. Replace `hotel-ismini.example` in SEO files and HTML metadata with the real domain.
3. Complete and legally review the [imprint](imprint.html) and [privacy policy](privacy.html).
4. Configure hosting, backups, monitoring and a production database such as PostgreSQL.
5. Add a verified email workflow, cancellation process and payment or channel-manager integration if required.
6. Configure cookie/privacy behavior for every actual third-party service.
