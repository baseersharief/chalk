const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const db = require("./db");
const seed = require("./seed");

seed();

function createSession(userId) {
  const token = crypto.randomBytes(24).toString("hex");
  db.prepare("INSERT INTO sessions (token, user_id) VALUES (?, ?)").run(token, userId);
  return token;
}

function destroySession(token) {
  if (!token) return;
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

function userFromToken(token) {
  if (!token) return null;
  return db.prepare(`
    SELECT users.id, users.email, users.display_name, users.role
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ?
  `).get(token) || null;
}

function findUserByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(String(email || "").trim().toLowerCase());
}

function verifyPassword(user, password) {
  return Boolean(user && bcrypt.compareSync(password, user.password_hash));
}

function createUser({ email, displayName, password }) {
  const passwordHash = bcrypt.hashSync(password, 10);
  const info = db.prepare(
    "INSERT INTO users (email, password_hash, display_name, role) VALUES (?, ?, ?, 'member')"
  ).run(email, passwordHash, displayName);
  return db.prepare("SELECT id, email, display_name, role FROM users WHERE id = ?").get(info.lastInsertRowid);
}

module.exports = {
  createSession,
  destroySession,
  userFromToken,
  findUserByEmail,
  verifyPassword,
  createUser
};
