import { currentUser } from "@/lib/actions";
import db from "@/lib/db";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ModPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "officer") {
    return (
      <main className="narrow">
        <h1>Officer desk</h1>
        <p className="lede">This page is for club officers. Your account is a member account.</p>
      </main>
    );
  }

  const notes = db.prepare("SELECT * FROM officer_desk ORDER BY id").all();

  return (
    <main className="narrow">
      <h1>Officer desk</h1>
      <p className="lede">Do not copy these onto the public wall. This is the paper notebook, digitized.</p>
      {notes.map((note) => (
        <section key={note.id} className="desk">
          <h2>{note.title}</h2>
          <p>{note.note}</p>
        </section>
      ))}
    </main>
  );
}
