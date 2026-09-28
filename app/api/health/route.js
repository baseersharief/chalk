import db from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET() {
  db.prepare("SELECT 1 AS ok").get();
  return Response.json({ ok: true });
}
