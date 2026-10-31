# Hotel Ismini

Responsive, multilingual hotel website with a Node.js/Express backend, SQLite demo database and server-side booking availability checks.

> **Demo status:** Room data, prices, contact details and images are sample content. The booking system stores demo data, does not take payments and does not send emails. Complete and legally review the content before production use.

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

Available settings are `PORT`, `DB_PATH` and `TRUST_PROXY`. Never commit `.env` or database files.

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
- `POST /api/bookings` - validates and stores a demo booking
- `POST /api/restaurant-requests` - stores a restaurant request

Prices and availability are never trusted from the browser. The server validates booking input and prevents overlapping bookings in a transaction.

## Before production

1. Replace sample hotel data and SVG placeholders.
2. Replace `hotel-ismini.example` in SEO files and HTML metadata with the real domain.
3. Complete and legally review the [imprint](imprint.html) and [privacy policy](privacy.html).
4. Configure hosting, backups, monitoring and a production database such as PostgreSQL.
5. Add a verified email workflow, cancellation process and payment or channel-manager integration if required.
6. Configure cookie/privacy behavior for every actual third-party service.
