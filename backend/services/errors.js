/* errors.js – Eigene Fehlerarten. Der errorHandler macht daraus HTTP-Antworten. */

/** Eingaben sind ungültig -> HTTP 422. "errors" enthält Feld -> Fehlercode. */
class ValidationError extends Error {
  constructor(errors) {
    super("Validation failed");
    this.name = "ValidationError";
    this.errors = errors;
  }
}

/** Zimmer sind für den Zeitraum nicht (mehr) frei -> HTTP 409. */
class ConflictError extends Error {
  constructor(message = "Room is no longer available for these dates") {
    super(message);
    this.name = "ConflictError";
  }
}

module.exports = { ValidationError, ConflictError };
