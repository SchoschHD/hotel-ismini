const crypto = require("node:crypto");

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const sessions = new Map();

function configuredPassword() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be configured with at least 12 characters");
  }
  return password;
}

function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((part) => part.trim().split("=")).filter(([key, value]) => key && value));
}

function login(req, res) {
  const password = req.body?.password;
  if (typeof password !== "string" || !safeEqual(password, configuredPassword())) {
    return res.status(401).json({ error: "invalid_credentials" });
  }
  const token = crypto.randomBytes(32).toString("base64url");
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  res.set("Set-Cookie", `ismini_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return res.json({ authenticated: true });
}

function logout(req, res) {
  const token = parseCookies(req.headers.cookie).ismini_admin;
  if (token) sessions.delete(token);
  res.set("Set-Cookie", "ismini_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
  res.status(204).end();
}

function requireAdmin(req, res, next) {
  const token = parseCookies(req.headers.cookie).ismini_admin;
  const expires = token && sessions.get(token);
  if (!expires || expires < Date.now()) {
    if (token) sessions.delete(token);
    return res.status(401).json({ error: "admin_auth_required" });
  }
  return next();
}

function adminPage(req, res, next) {
  const token = parseCookies(req.headers.cookie).ismini_admin;
  if (token && sessions.get(token) > Date.now()) return res.sendFile(req.app.locals.adminPage);
  return res.sendFile(req.app.locals.adminLoginPage, (error) => error && next(error));
}

module.exports = { login, logout, requireAdmin, adminPage, configuredPassword };
