"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import db from "./db";
import {
  createSession,
  destroySession,
  userFromToken,
  findUserByEmail,
  verifyPassword,
  createUser
} from "./auth";

export async function currentUser() {
  const jar = await cookies();
  return userFromToken(jar.get("chalk_session")?.value);
}

export async function loginAction(formData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const user = findUserByEmail(email);
  if (!verifyPassword(user, password)) {
    redirect("/login?error=1");
  }
  const token = createSession(user.id);
  const jar = await cookies();
  jar.set("chalk_session", token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 14
  });
  redirect("/");
}

export async function logoutAction() {
  const jar = await cookies();
  destroySession(jar.get("chalk_session")?.value);
  jar.delete("chalk_session");
  redirect("/");
}

export async function registerAction(formData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const displayName = String(formData.get("displayName") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email.endsWith(".edu") || displayName.length < 2 || password.length < 8) {
    redirect("/register?error=1");
  }
  if (findUserByEmail(email)) {
    redirect("/register?error=2");
  }

  const user = createUser({ email, displayName, password });
  const token = createSession(user.id);
  const jar = await cookies();
  jar.set("chalk_session", token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 14
  });
  redirect("/");
}

export async function createPostAction(formData) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const body = String(formData.get("body") || "").trim();
  if (body.length < 3 || body.length > 2000) {
    redirect("/compose?error=1");
  }
  db.prepare("INSERT INTO posts (user_id, body) VALUES (?, ?)").run(user.id, body);
  redirect("/");
}

export async function deletePostAction(formData) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const id = Number(formData.get("id"));
  const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(id);
  if (!post) redirect("/");
  if (post.user_id !== user.id && user.role !== "officer") {
    redirect("/");
  }
  db.prepare("DELETE FROM posts WHERE id = ?").run(id);
  redirect("/");
}
