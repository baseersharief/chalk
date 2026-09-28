const bcrypt = require("bcryptjs");
const db = require("./db");

function seed() {
  const existing = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  if (existing > 0) {
    return { seeded: false, users: existing };
  }

  const hash = (plain) => bcrypt.hashSync(plain, 10);
  const insertUser = db.prepare(
    "INSERT INTO users (email, password_hash, display_name, role) VALUES (?, ?, ?, ?)"
  );

  const maya = insertUser.run("maya@campus.edu", hash("campus123"), "Maya Chen", "member").lastInsertRowid;
  const devon = insertUser.run("devon@campus.edu", hash("campus123"), "Devon Alvarez", "member").lastInsertRowid;
  insertUser.run("priya@campus.edu", hash("officer123"), "Priya Nair", "officer");

  const insertPost = db.prepare(
    "INSERT INTO posts (user_id, body, pinned, created_at) VALUES (?, ?, ?, ?)"
  );

  insertPost.run(
    maya,
    "Welcome to the **Robotics Club** wall.\n\nUse this board for shop hours, ride shares, and parts that need to come back to the cage. Officers pin the important stuff.",
    1,
    "2026-08-28 09:15:00"
  );
  insertPost.run(
    devon,
    "Shop is open tonight 7–10. Bring closed-toe shoes. The mill is booked, but the *Prusa bed* is free.\n\nIf you borrowed the calipers, please put them back on the labeled hook.",
    0,
    "2026-09-02 16:40:00"
  );
  insertPost.run(
    maya,
    "Ride needed to Mid-Atlantic Comp Saturday 6am. Two seats left in the gray Odyssey. DM me or reply here.\n\nPack list: [team handbook](/mod) is only for officers — don't use that link unless you are one.",
    0,
    "2026-09-04 11:05:00"
  );
  insertPost.run(
    devon,
    "Lost a green water bottle near the east stair. Has tape on the lid with `DC` written on it.",
    0,
    "2026-09-06 18:22:00"
  );

  db.prepare("INSERT INTO officer_desk (title, note) VALUES (?, ?)").run(
    "Cage combination (do not post on the public wall)",
    "West cage lock is 18-24-09. Spare key lives in the labeled envelope in Priya's drawer. After-hours incident line is x4419."
  );

  return { seeded: true, users: 3 };
}

if (require.main === module) {
  const result = seed();
  console.log(result.seeded ? "Seeded a fresh Chalk database." : "Database already has users; skipping seed.");
}

module.exports = seed;
