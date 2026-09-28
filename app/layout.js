import "./globals.css";
import { currentUser, logoutAction } from "@/lib/actions";

export const metadata = {
  title: "Chalk",
  description: "Club announcement wall"
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }) {
  const user = await currentUser();

  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="top">
            <a className="brand" href="/">
              <span className="brand-mark">CH</span>
              <span>
                <strong>Chalk</strong>
                <em>Robotics Club wall</em>
              </span>
            </a>
            <nav>
              <a href="/">Wall</a>
              {user ? (
                <>
                  <a href="/compose">Post</a>
                  {user.role === "officer" ? <a href="/mod">Officer desk</a> : null}
                  <form action={logoutAction}>
                    <button className="text-btn" type="submit">Sign out</button>
                  </form>
                </>
              ) : (
                <>
                  <a href="/login">Sign in</a>
                  <a className="btn btn-solid" href="/register">Join</a>
                </>
              )}
            </nav>
          </header>
          {children}
          <footer>
            Chalk is the unofficial Robotics Club board. Shop safety rules still live on paper next to the cage.
          </footer>
        </div>
      </body>
    </html>
  );
}
