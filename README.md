# ELMTREE 🌳

Interactive homepage for the grove. A generative elm tree — every
terminal branch carries a clickable leaf. Clicking a leaf opens a lock gate; the
right password lands you in that person's personal space: a corkboard-style kanban
board **and** a chat window with their own assistant.

Built to mirror the personal Kandan setup, but scoped, non-sensitive, and cheap to
run — chat is routed through DeepSeek (pennies), board data lives in Cloudflare KV.

## Architecture

```
index.html  — generative elm tree (SVG), clickable leaves, lock gate
leaf.html   — personal space: kanban board + assistant chat
elm.js      — tree engine + leaf placement + unlock flow
leaf.js     — board render/save + chat client
functions/  — Cloudflare Pages Functions (auth + persistence + chat proxy)
styles.css  — shared "dark grove" theme
```

- **`/api/leaves`** — public list of leaf names (id + display name only)
- **`/api/unlock`** — verify a leaf password → short-lived signed token
- **`/api/board`** — per-leaf kanban, KV-backed, write-protected by token
- **`/api/chat`** — DeepSeek (or OpenAI) chat proxy, keyed to the leaf's assistant persona

## Security model

- Leaf passwords are **never** in this repo — each digests into an
  `ELM_LEAF_SECRETS` secret binding (sha256 hex), checked server-side.
- Unlock issues an HMAC-signed token (payload `leafId.epoch`, verified
  signature + expiry) that gates board writes and chat. 4h TTL.
- DeepSeek/OpenAI keys live only in secret bindings — never committed, never sent
  to the browser.
- Static assets carry a locked-down CSP (no inline scripts, no framing), matching
  the parent's `edufintech` policy.

This is a **workplace conveniences** layer. Card text is assumed non-sensitive and
non-student-data (per project scope). Do not put FERPA/student records here.

## Setup

This is a **static + Functions** Cloudflare Pages project. It's currently hosted at
`edufintech.org/elm/` for now; it's a standalone repo so it can move to a school
domain later.

1. **Create the KV namespace** and paste its id into `wrangler.toml`:
   ```bash
   wrangler kv namespace create ELM   # prints an id
   ```
2. **Create the Pages project** for elmtree:
   ```bash
   wrangler pages project create elmtree --production-branch main
   ```
3. **Set the secrets** (once each):
   ```bash
   wrangler pages secret put ELM_TOKEN_SECRET
   wrangler pages secret put DEEPSEEK_API_KEY
   wrangler pages secret put ELM_LEAF_SECRETS
   ```

   `ELM_LEAF_SECRETS` is a JSON string. Generate a leaf's hash:
   ```bash
   echo -n 'thepassword' | sha256sum
   ```
   Then e.g.:
   ```json
   { "facilities": { "pass_hash": "<hex>", "assistant": "You are the facilities team assistant. Keep replies short and practical." } }
   ```
   (The leaf registry itself — which leaves exist and their display names — is in
   `functions/_shared.js`, public by design.)
4. **Deploy**:
   ```bash
   wrangler pages deploy . --project-name elmtree --branch main
   ```

## Hosting under edufintext.org/elm/

To serve this under the existing `edufintech.org` domain at `/elm/`:

- Option A (redirect): add to the `edufintech` project's `_redirects`
  `/elm/*  https://elmtree.<subdomain>.pages.dev/:splat  200` — but trailing-function
  calls (e.g. chat) won't survive a full redirect. Prefer Option B.
- Option B (same project): copy this repo's static files + `functions/` into the
  `edufintech` Pages project under an `elm/` dir, and set the KV + secrets on that
  project too. Simplest if they'll share a domain long-term.

User likely to choose whichever is easiest operationally; the repo is structured so
both work.

## Roadmap (not yet built)

- Per-leaf Google Calendar live-insert (wired to the leaf member's real calendar via
  their own OAuth — not a shared master token)
- "Locked" leaves that gate both read and write (currently read of the page is
  public; content + write are gated)
- Git-backed board history / audit trail

## Note on scope

Per Shaker's preferences, this repo stays a **public** playground of non-sensitive
workplace helpers. Nothing with real credentials or school/student data lives here.