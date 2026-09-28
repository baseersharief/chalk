import { createPostAction, currentUser } from "@/lib/actions";
import { redirect } from "next/navigation";

export default async function ComposePage({ searchParams }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const error = params?.error;

  return (
    <main className="narrow">
      <h1>Write on the wall</h1>
      <p className="lede">A few sentences is enough. Officers will pin anything the whole shop needs to see.</p>
      {error ? <p className="flash">Write between 3 and 2000 characters.</p> : null}
      <form className="stack" action={createPostAction}>
        <label>
          <span>Post</span>
          <textarea name="body" required maxLength={2000} placeholder="Shop hours, a missing tool, a ride…" />
        </label>
        <button className="btn-solid" type="submit">Post to the wall</button>
      </form>
      <p className="help">
        Formatting: <code>**bold**</code>, <code>*italic*</code>, <code>`code`</code>,
        headings with <code>##</code>, and <code>[label](https://…)</code> for links.
      </p>
    </main>
  );
}
