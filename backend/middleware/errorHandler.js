/* ==========================================================
   errorHandler.js – Macht aus Fehlern passende HTTP-Antworten.
   422 ungültige Eingabe | 409 Zimmer vergeben | 400 kaputtes JSON | 500 sonst
   Interne Fehler werden nur auf dem Server protokolliert, nie an den Browser gesendet.
   Es werden keine personenbezogenen Daten ins Log geschrieben.
   ========================================================== */
const { ValidationError, ConflictError } = require("../services/errors");

function apiNotFound(req, res) {
  res.status(404).json({ error: "not_found" });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ValidationError) return res.status(422).json({ error: "validation_failed", errors: err.errors });
  if (err instanceof ConflictError) return res.status(409).json({ error: "not_available" });
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "invalid_json" });
  if (err.type === "entity.too.large") return res.status(413).json({ error: "payload_too_large" });

  console.error("Interner Fehler:", err.name, err.message);
  res.status(500).json({ error: "server_error" });
}

module.exports = { apiNotFound, errorHandler };
