const nodemailer = require("nodemailer");

let transporter;

function emailConfig() {
  const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "MAIL_FROM", "HOTEL_EMAIL"];
  const missing = required.filter((key) => !process.env[key]);
  return missing.length ? { configured: false, missing } : {
    configured: true,
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM,
    hotelEmail: process.env.HOTEL_EMAIL,
  };
}

function getTransporter(config) {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
    });
  }
  return transporter;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(new Date(`${value}T00:00:00Z`));
}

function formatPrice(cents, currency) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(cents / 100);
}

function bookingSummary(booking) {
  return [
    `Buchungsnummer: ${booking.bookingNumber}`,
    `Zimmer: ${booking.roomName}`,
    `Anreise: ${formatDate(booking.checkIn)}`,
    `Abreise: ${formatDate(booking.checkOut)}`,
    `Nächte: ${booking.nights}`,
    `Zimmeranzahl: ${booking.rooms}`,
    `Gäste: ${booking.adults} Erwachsene, ${booking.children} Kinder`,
    `Gesamtpreis: ${formatPrice(booking.totalPrice, booking.currency)}`,
  ].join("\n");
}

function bookingEmailMessages(booking, config = emailConfig()) {
  const summary = bookingSummary(booking);
  return {
    guest: {
      from: config.from,
      to: booking.email,
      subject: `Buchungsbestätigung ${booking.bookingNumber} – Hotel Ismini`,
      text: `Hallo ${booking.firstName},\n\nvielen Dank für Ihre Buchung im Hotel Ismini.\n\n${summary}\n\nDiese Nachricht wurde automatisch erstellt.`,
    },
    hotel: {
      from: config.from,
      to: config.hotelEmail,
      subject: `Neue Buchung ${booking.bookingNumber} – ${booking.firstName} ${booking.lastName}`,
      text: `Eine neue Buchung wurde erstellt.\n\nGast: ${booking.firstName} ${booking.lastName}\nE-Mail: ${booking.email}\nTelefon: ${booking.phone || "-"}\n\n${summary}\n\nNotizen: ${booking.notes || "-"}`,
    },
  };
}

async function sendBookingEmails(booking) {
  const config = emailConfig();
  if (!config.configured) {
    console.warn(`E-Mail-Versand deaktiviert: fehlende SMTP-Konfiguration (${config.missing.join(", ")})`);
    return { emailSent: false, reason: "email_not_configured" };
  }
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    console.error("E-Mail-Versand fehlgeschlagen: SMTP_PORT ist ungültig");
    return { emailSent: false, reason: "email_configuration_invalid" };
  }

  try {
    const messages = bookingEmailMessages(booking, config);
    await Promise.all([getTransporter(config).sendMail(messages.guest), getTransporter(config).sendMail(messages.hotel)]);
    return { emailSent: true };
  } catch (error) {
    console.error("E-Mail-Versand fehlgeschlagen:", error.name, error.message);
    return { emailSent: false, reason: "email_delivery_failed" };
  }
}

function resetTransporterForTests() {
  transporter = undefined;
}

module.exports = { sendBookingEmails, bookingEmailMessages, emailConfig, resetTransporterForTests };
