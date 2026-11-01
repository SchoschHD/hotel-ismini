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
  const guestName = `${booking.firstName} ${booking.lastName}`;
  return {
    guest: {
      from: config.from,
      to: booking.email,
      subject: `Buchungsbestätigung ${booking.bookingNumber} – Hotel Ismini`,
      text: `Hallo ${booking.firstName},\n\nvielen Dank für Ihre Buchung im Hotel Ismini.\n\n${summary}\n\nDiese Nachricht wurde automatisch erstellt.`,
      html: emailHtml("Buchungsbestätigung", `Hallo ${escapeHtml(booking.firstName)},<br><br>vielen Dank für Ihre Buchung im Hotel Ismini.`, summaryHtml(booking), "#193D52"),
    },
    hotel: {
      from: config.from,
      to: config.hotelEmail,
      subject: `Neue Buchung ${booking.bookingNumber} – ${guestName}`,
      text: `Eine neue Buchung wurde erstellt.\n\nGast: ${guestName}\nE-Mail: ${booking.email}\nTelefon: ${booking.phone || "-"}\n\n${summary}\n\nNotizen: ${booking.notes || "-"}`,
      html: emailHtml("Neue Buchung", `Eine neue Buchung wurde erstellt.<br><br><strong>Gast:</strong> ${escapeHtml(guestName)}<br><strong>E-Mail:</strong> ${escapeHtml(booking.email)}<br><strong>Telefon:</strong> ${escapeHtml(booking.phone || "-")}<br><br>${summaryHtml(booking)}<br><br><strong>Notizen:</strong> ${escapeHtml(booking.notes || "-")}`, "", "#193D52"),
    },
  };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function summaryHtml(booking) {
  return bookingSummary(booking).split("\n").map((line) => escapeHtml(line)).join("<br>");
}

function emailHtml(title, intro, summaryMarkup, color) {
  return `<!doctype html><html><body style="margin:0;background:#f3f0ea;font-family:Arial,sans-serif;color:#193d52"><div style="max-width:620px;margin:24px auto;background:#fff;border-radius:8px;overflow:hidden"><header style="padding:24px;background:${color};color:#fff"><h1 style="margin:0;font-size:24px">Hotel Ismini</h1></header><main style="padding:28px;line-height:1.55"><h2 style="margin-top:0">${title}</h2><p>${intro}</p>${summaryMarkup ? `<p>${summaryMarkup}</p>` : ""}</main><footer style="padding:16px 28px;background:#f3f0ea;color:#52636b;font-size:12px">Diese Nachricht wurde automatisch erstellt.</footer></div></body></html>`;
}

function cancellationEmailMessage(booking, config = emailConfig()) {
  const summary = bookingSummary(booking);
  return {
    from: config.from,
    to: booking.email,
    subject: `Stornierung ${booking.bookingNumber} – Hotel Ismini`,
    text: `Hallo ${booking.firstName},\n\nIhre Buchung wurde storniert.\n\n${summary}\n\nBei Fragen kontaktieren Sie bitte das Hotel.`,
    html: emailHtml("Buchung storniert", `Hallo ${escapeHtml(booking.firstName)},<br><br>Ihre Buchung wurde storniert.`, summaryHtml(booking), "#8A3B35"),
  };
}

async function sendCancellationEmail(booking) {
  const config = emailConfig();
  if (!config.configured) {
    console.warn(`E-Mail-Versand deaktiviert: fehlende SMTP-Konfiguration (${config.missing.join(", ")})`);
    return { emailSent: false, reason: "email_not_configured" };
  }
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    console.error("Storno-E-Mail fehlgeschlagen: SMTP_PORT ist ungültig");
    return { emailSent: false, reason: "email_configuration_invalid" };
  }
  try {
    await getTransporter(config).sendMail(cancellationEmailMessage(booking, config));
    return { emailSent: true };
  } catch (error) {
    console.error("Storno-E-Mail fehlgeschlagen:", error.name, error.message);
    return { emailSent: false, reason: "email_delivery_failed" };
  }
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

module.exports = { sendBookingEmails, sendCancellationEmail, bookingEmailMessages, cancellationEmailMessage, emailConfig, resetTransporterForTests };
