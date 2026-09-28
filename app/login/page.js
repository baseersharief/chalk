import { loginAction, currentUser } from "@/lib/actions";
import { redirect } from "next/navigation";

export default async function LoginPage({ searchParams }) {
  const user = await currentUser();
  if (user) redirect("/");
  const params = await searchParams;
  const error = params?.error;

  return (
    <main className="narrow">
      <h1>Sign in</h1>
      <p className="lede">Demo accounts are in the project README.</p>
      {error ? <p className="flash">Those credentials do not match a Chalk account.</p> : null}
      <form className="stack" action={loginAction}>
        <label>
          <span>Email</span>
          <input type="email" name="email" autoComplete="username" required />
        </label>
        <label>
          <span>Password</span>
          <input type="password" name="password" autoComplete="current-password" required />
        </label>
        <button className="btn-solid" type="submit">Sign in</button>
      </form>
      <p className="lede">No account? <a href="/register">Join with a .edu email</a>.</p>
    </main>
  );
}
