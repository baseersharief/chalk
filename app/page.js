import db from "@/lib/db";
import { currentUser } from "@/lib/actions";
import { renderMarkdown } from "@/lib/markdown";
import PostBody from "@/components/PostBody";
import { deletePostAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await currentUser();
  const posts = db.prepare(`
    SELECT posts.*, users.display_name AS author
    FROM posts
    JOIN users ON users.id = posts.user_id
    ORDER BY posts.pinned DESC, posts.created_at DESC
  `).all();

  return (
    <main>
      <section className="hero">
        <h1>Write it on the wall.</h1>
        <p className="lede">
          Hours, ride shares, missing calipers, and the things officers used to bury in a group chat.
          Short posts. A little markdown. Pin the important ones.
        </p>
      </section>

      <section className="wall">
        {posts.length === 0 ? <p className="lede">The wall is empty.</p> : null}
        {posts.map((post) => (
          <article key={post.id} className={post.pinned ? "post pinned" : "post"}>
            {post.pinned ? <span className="pin" aria-hidden="true" /> : null}
            <div className="post-meta">
              <span>{post.author}{post.pinned ? " · pinned" : ""}</span>
              <span>{post.created_at}</span>
            </div>
            <PostBody html={renderMarkdown(post.body)} />
            {user && (user.id === post.user_id || user.role === "officer") ? (
              <form action={deletePostAction} style={{ marginTop: 12 }}>
                <input type="hidden" name="id" value={post.id} />
                <button className="text-btn" type="submit">Take down</button>
              </form>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  );
}
