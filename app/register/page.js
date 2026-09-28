import { registerAction, currentUser } from "@/lib/actions";
import { redirect } from "next/navigation";

export default async function RegisterPage({ searchParams }) {
  const user = await currentUser();
  if (user) redirect("/");
  const params = await searchParams;
  const error = params?.error;

  return (
    <main className="narrow">
      <h1>Join the wall</h1>
      <p className="lede">A .edu address keeps this board to people who can actually show up to shop hours.</p>
      {error === "2" ? <p className="flash">That email already has an account.</p> : null}
      {error === "1" ? <p className="flash">Use a .edu email, a display name, and a password of at least eight characters.</p> : null}
      <form className="stack" action={registerAction}>
        <label>
          <span>Campus email</span>
          <input type="email" name="email" required />
        </label>
        <label>
          <span>Display name</span>
          <input type="text" name="displayName" required />
        </label>
        <label>
          <span>Password</span>
          <input type="password" name="password" minLength={8} required />
        </label>
        <button className="btn-solid" type="submit">Create account</button>
      </form>
    </main>
  );
}
