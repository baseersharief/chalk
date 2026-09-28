"use client";

import { logoutAction } from "@/lib/actions";

export default function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button type="submit" className="text-btn">Sign out</button>
    </form>
  );
}
