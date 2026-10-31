const api = (path, options = {}) => fetch("/api/admin" + path, { credentials: "same-origin", ...options });
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const money = (cents, currency) => `${(cents / 100).toFixed(2)} ${currency}`;

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
  const data = await response.json();
  document.querySelector("#bookings").innerHTML = data.bookings.map((booking) => `<tr><td>${escapeHtml(booking.bookingNumber)}</td><td>${escapeHtml(booking.firstName)} ${escapeHtml(booking.lastName)}<br>${escapeHtml(booking.email)}</td><td>${escapeHtml(booking.roomName)} (${booking.rooms})</td><td>${booking.checkIn} – ${booking.checkOut}</td><td>${money(booking.totalCents, booking.currency)}</td><td class="status-${booking.status}">${booking.status}</td><td>${booking.status === "confirmed" ? `<button data-cancel="${booking.id}" type="button">Stornieren</button>` : ""}</td></tr>`).join("") || "<tr><td colspan='7'>Keine Buchungen vorhanden.</td></tr>";
  document.querySelector("#requests").innerHTML = data.restaurantRequests.map((item) => `<tr><td>${escapeHtml(item.name)}<br>${escapeHtml(item.email)}</td><td>${item.date} ${item.time}</td><td>${item.guests}</td><td>${escapeHtml(item.phone)}</td><td>${escapeHtml(item.notes)}</td></tr>`).join("") || "<tr><td colspan='5'>Keine Anfragen vorhanden.</td></tr>";
  renderRooms(data.rooms);
  document.querySelectorAll("[data-cancel]").forEach((button) => button.addEventListener("click", async () => {
    if (!window.confirm("Buchung wirklich stornieren?")) return;
    const result = await api(`/bookings/${button.dataset.cancel}/cancel`, { method: "POST" });
    if (result.ok) window.location.reload();
  }));
}

document.querySelector("#logout")?.addEventListener("click", async () => { await api("/logout", { method: "POST" }); window.location.href = "/admin.html"; });
login().catch((error) => { document.querySelector("#login-status").textContent = error.message; });
dashboard().catch((error) => { document.querySelector("#status").textContent = error.message; document.querySelector("#status").className = "error"; });
