const api = (path, options = {}) => fetch("/api/admin" + path, { credentials: "same-origin", ...options });
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const money = (cents, currency) => `${(cents / 100).toFixed(2)} ${currency}`;
let dashboardData;

async function login() {
  const form = document.querySelector("#login-form");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = document.querySelector("#login-status");
    try {
      const response = await api("/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: form.password.value }) });
      if (!response.ok) throw new Error("Anmeldung fehlgeschlagen");
      window.location.href = "/admin.html";
    } catch (error) { status.textContent = error.message; }
  });
}

function renderRooms(rooms) {
  document.querySelector("#rooms").innerHTML = rooms.map((room) => `
    <form class="room-card" data-room-id="${room.id}">
      <h3>${escapeHtml(room.name)}</h3>
      <label>Name<input name="name" value="${escapeHtml(room.name)}" required></label>
      <label>Max. Gäste<input name="maxGuests" type="number" min="1" max="12" value="${room.maxGuests}" required></label>
      <label>Anzahl Zimmer<input name="units" type="number" min="0" max="100" value="${room.units}" required></label>
      <label>Preis/Nacht (EUR)<input name="price" type="number" min="0" step="0.01" value="${(room.pricePerNightCents / 100).toFixed(2)}" required></label>
      <button type="submit">Speichern</button>
    </form>`).join("");
  document.querySelectorAll("[data-room-id]").forEach((form) => form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const response = await api(`/rooms/${form.dataset.roomId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: data.get("name"), maxGuests: data.get("maxGuests"), units: data.get("units"), pricePerNightCents: Math.round(Number(data.get("price")) * 100) }) });
    document.querySelector("#status").textContent = response.ok ? "Zimmer gespeichert." : "Zimmer konnte nicht gespeichert werden.";
    document.querySelector("#status").className = response.ok ? "ok" : "error";
  }));
}

async function dashboard() {
  if (!document.querySelector("#bookings")) return;
  const response = await api("/data");
  if (response.status === 401) return window.location.href = "/admin.html";
  if (!response.ok) throw new Error("Daten konnten nicht geladen werden.");
  dashboardData = await response.json();
  renderBookings();
  const data = dashboardData;
  renderRequests();
  renderRooms(data.rooms);
}

function showStatus(message, success) {
  const status = document.querySelector("#status");
  status.textContent = message;
  status.className = success ? "ok" : "error";
}

function cancellationEmailStatus(reason) {
  if (reason === "email_not_configured") return "Buchung storniert; SMTP-Mailversand ist nicht konfiguriert.";
  if (reason === "email_configuration_invalid") return "Buchung storniert; die SMTP-Konfiguration ist ungültig.";
  return "Buchung storniert; Storno-Mail konnte nicht versendet werden. Bitte Server-Log prüfen.";
}

function renderBookings() {
  const query = document.querySelector("#booking-search")?.value.trim().toLowerCase() || "";
  const bookings = (dashboardData?.bookings || []).filter((booking) => Object.values(booking).some((value) => String(value ?? "").toLowerCase().includes(query)));
  document.querySelector("#bookings").innerHTML = bookings.map((booking) => `<tr><td>${escapeHtml(booking.bookingNumber)}</td><td>${escapeHtml(booking.firstName)} ${escapeHtml(booking.lastName)}<br>${escapeHtml(booking.email)}</td><td>${escapeHtml(booking.roomName)} (${booking.rooms})</td><td>${booking.checkIn} – ${booking.checkOut}</td><td>${money(booking.totalCents, booking.currency)}</td><td class="status-${booking.status}">${booking.status}</td><td>${booking.status === "confirmed" ? `<button data-cancel="${booking.id}" type="button">Stornieren</button>` : ""}<button class="btn-danger" data-delete="${booking.id}" type="button">Entfernen</button></td></tr>`).join("") || "<tr><td colspan='7'>Keine passenden Buchungen vorhanden.</td></tr>";
  document.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", async () => {
    if (!window.confirm("Buchung endgültig aus dem System löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.")) return;
    const result = await api(`/bookings/${button.dataset.delete}`, { method: "DELETE" });
    if (result.ok) dashboard();
  }));
  document.querySelectorAll("[data-cancel]").forEach((button) => button.addEventListener("click", async () => {
    if (!window.confirm("Buchung wirklich stornieren?")) return;
    const result = await api(`/bookings/${button.dataset.cancel}/cancel`, { method: "POST" });
    if (result.ok) {
      const resultData = await result.json();
      showStatus(resultData.emailSent ? "Buchung storniert und Kunde benachrichtigt." : cancellationEmailStatus(resultData.reason), resultData.emailSent);
      dashboard();
    }
  }));
}

function renderRequests() {
  const query = document.querySelector("#request-search")?.value.trim().toLowerCase() || "";
  const requests = (dashboardData?.restaurantRequests || []).filter((item) => Object.values(item).some((value) => String(value ?? "").toLowerCase().includes(query)));
  document.querySelector("#requests").innerHTML = requests.map((item) => `<tr><td>${escapeHtml(item.name)}<br>${escapeHtml(item.email)}</td><td>${item.date} ${item.time}</td><td>${item.guests}</td><td>${escapeHtml(item.phone)}</td><td>${escapeHtml(item.notes)}</td><td><div class="request-actions"><select data-request-status="${item.id}" aria-label="Status für Anfrage"><option value="pending" ${item.status === "pending" ? "selected" : ""}>Offen</option><option value="confirmed" ${item.status === "confirmed" ? "selected" : ""}>Bestätigt</option><option value="rejected" ${item.status === "rejected" ? "selected" : ""}>Abgelehnt</option></select>${item.status !== "rejected" ? `<button data-cancel-request="${item.id}" type="button">Stornieren</button>` : ""}<button class="btn-danger" data-delete-request="${item.id}" type="button">Entfernen</button></div></td></tr>`).join("") || "<tr><td colspan='6'>Keine passenden Anfragen vorhanden.</td></tr>";
  document.querySelectorAll("[data-request-status]").forEach((select) => select.addEventListener("change", async () => {
    const result = await api(`/restaurant-requests/${select.dataset.requestStatus}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: select.value }) });
    showStatus(result.ok ? "Status gespeichert." : "Status konnte nicht gespeichert werden.", result.ok);
  }));
  document.querySelectorAll("[data-cancel-request]").forEach((button) => button.addEventListener("click", async () => {
    if (!window.confirm("Restaurantanfrage wirklich stornieren?")) return;
    const result = await api(`/restaurant-requests/${button.dataset.cancelRequest}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "rejected" }) });
    if (result.ok) {
      showStatus("Restaurantanfrage storniert.", true);
      dashboard();
    } else {
      showStatus("Restaurantanfrage konnte nicht storniert werden.", false);
    }
  }));
  document.querySelectorAll("[data-delete-request]").forEach((button) => button.addEventListener("click", async () => {
    if (!window.confirm("Restaurantanfrage endgültig löschen?")) return;
    const result = await api(`/restaurant-requests/${button.dataset.deleteRequest}`, { method: "DELETE" });
    if (result.ok) dashboard();
  }));
}

document.querySelector("#logout")?.addEventListener("click", async () => { await api("/logout", { method: "POST" }); window.location.href = "/admin.html"; });
document.querySelector("#refresh")?.addEventListener("click", () => dashboard());
document.querySelector("#booking-search")?.addEventListener("input", renderBookings);
document.querySelector("#request-search")?.addEventListener("input", renderRequests);
login().catch((error) => { document.querySelector("#login-status").textContent = error.message; });
dashboard().catch((error) => { document.querySelector("#status").textContent = error.message; document.querySelector("#status").className = "error"; });
