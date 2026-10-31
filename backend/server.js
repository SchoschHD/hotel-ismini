/* ==========================================================
   server.js – Startpunkt des Backends (Express).
   - liefert die Website aus (nur freigegebene Ordner und Seiten)
   - stellt die API bereit: /api/availability, /api/bookings, /api/restaurant-requests
   Start: npm start   |   Konfiguration: .env (siehe .env.example)
   ========================================================== */
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { openDatabase } = require("./database/database");
const availabilityRoutes = require("./routes/availabilityRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const { apiNotFound, errorHandler } = require("./middleware/errorHandler");

const SITE_ROOT = path.join(__dirname, "..");
const PAGES = ["index", "rooms", "experiences", "restaurant", "wellness", "booking", "imprint", "privacy"];

/** Baut die Express-App. Die Datenbank wird übergeben, damit Tests eine eigene nutzen können. */
function createApp(db, { rateLimitMax = 60 } = {}) {
  const app = express();
  app.locals.db = db;
  app.disable("x-powered-by");
  if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

  // Sicherheits-Header. Skripte und Schriften nur von der eigenen Domain.
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"], // style="--ratio: …" in den HTML-Seiten
        "img-src": ["'self'", "data:"],
        "font-src": ["'self'"],
        "connect-src": ["'self'"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "frame-ancestors": ["'none'"],
      },
    },
  }));

  // API: nur kleine JSON-Anfragen, nichts zwischenspeichern, Schreibzugriffe begrenzen
  app.use("/api", (req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  app.use("/api", express.json({ limit: "20kb" }));
  const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: rateLimitMax, standardHeaders: true, legacyHeaders: false, message: { error: "too_many_requests" } });
  app.use("/api/bookings", writeLimiter);
  app.use("/api/restaurant-requests", writeLimiter);

  app.use("/api/availability", availabilityRoutes);
  app.use("/api", bookingRoutes);
  app.use("/api", apiNotFound);

  // Website: nur freigegebene Ordner und Seiten (nie backend/, tests/, .env, *.db)
  for (const dir of ["css", "js", "images", "assets"]) {
    app.use("/" + dir, express.static(path.join(SITE_ROOT, dir), {
      maxAge: "1h",
      dotfiles: "ignore",
      // Express kennt AVIF nicht von selbst: richtigen Dateityp setzen
      setHeaders: (res, filePath) => { if (filePath.endsWith(".avif")) res.type("image/avif"); },
    }));
  }
  app.get("/", (req, res) => res.sendFile(path.join(SITE_ROOT, "index.html")));
  app.get("/:page.html", (req, res, next) => {
    if (!PAGES.includes(req.params.page)) return next();
    res.sendFile(path.join(SITE_ROOT, req.params.page + ".html"), (err) => err && next());
  });
  for (const file of ["sitemap.xml", "robots.txt"]) {
    app.get("/" + file, (req, res, next) => res.sendFile(path.join(SITE_ROOT, file), (err) => err && next()));
  }
  app.use((req, res) => res.status(404).type("text").send("Not found"));

  app.use(errorHandler);
  return app;
}

// Nur starten, wenn die Datei direkt ausgeführt wird (nicht beim Import in Tests)
if (require.main === module) {
  const dbPath = process.env.DB_PATH ? path.resolve(SITE_ROOT, process.env.DB_PATH) : undefined;
  const db = openDatabase(dbPath);
  const port = Number(process.env.PORT) || 3000;
  createApp(db).listen(port, () => {
    console.log(`Hotel Ismini läuft auf http://localhost:${port}`);
    console.log("Demo-Modus: Zimmer und Preise sind Beispieldaten.");
  });
}

module.exports = { createApp };
