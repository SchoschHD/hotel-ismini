/* Cookie consent for the current first-party-only demo. */
const STORAGE_KEY = "ismini.cookie-consent";

function readConsent() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "necessary" || value === "all" ? value : null;
  } catch {
    return null;
  }
}

function saveConsent(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // The banner remains available when storage is disabled.
  }
}

export function initCookieConsent() {
  const banner = document.querySelector("[data-cookie-consent]");
  const settings = document.querySelector("[data-cookie-settings]");
  if (!banner || !settings) return;

  const close = () => {
    banner.hidden = true;
    settings.hidden = false;
  };

  const open = () => {
    banner.hidden = false;
    banner.querySelector("[data-cookie-necessary]")?.focus();
  };

  banner.querySelector("[data-cookie-necessary]")?.addEventListener("click", () => {
    saveConsent("necessary");
    close();
  });
  banner.querySelector("[data-cookie-all]")?.addEventListener("click", () => {
    saveConsent("all");
    close();
  });
  settings.addEventListener("click", open);

  if (readConsent()) {
    banner.hidden = true;
    settings.hidden = false;
  } else {
    settings.hidden = true;
    banner.hidden = false;
  }

  document.addEventListener("languagechange", () => {
    if (!banner.hidden) banner.querySelector("[data-cookie-necessary]")?.focus();
  });
}
