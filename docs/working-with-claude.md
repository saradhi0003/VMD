# Working with Claude on this repo — spend fewer tokens

The biggest token cost is **re-deriving context** (re-reading files, re-exploring) and **long transcripts**.
This repo is set up so you almost never need to do that. Practical levers, highest impact first:

## 1. Point Claude at one doc, not the whole codebase
`CLAUDE.md` loads automatically and is just a **router**. Start a task by naming the doc:
> "Read `docs/screens.md`, then add an `/owner/inventory` screen."

That loads ~1 focused file instead of Claude grepping the tree. Use the routing table in `CLAUDE.md`.

## 2. One task per chat; reset between tasks
- New feature / unrelated task → **start a fresh chat** (or `/clear`). A long transcript is re-sent every
  turn, so a 200-message thread is the single biggest silent token drain.
- Mid-task but the thread is long → **`/compact`** to summarise and keep going.

## 3. Reference paths; don't paste
Say "look at `apps/web/src/app/owner/sales/page.tsx`" instead of pasting the file. Claude reads exactly
what it needs. Same for errors — paste the 3 relevant lines, not the whole log.

## 4. Use the cheap verification, not the expensive one
- `pnpm typecheck` (fast, whole repo) is the default check. Don't loop on full `pnpm build`.
- **Never run `pnpm build` while `pnpm dev` is live** — it corrupts `.next` and triggers a slow rebuild +
  debugging detour. (Stop dev → `rm -rf apps/web/.next` → build, if you must.)

## 5. Let Claude use subagents for big searches
For "where is X used across the repo", an Explore subagent keeps the heavy file-reading **out of the main
transcript** (its findings come back summarised). Don't over-use it for tiny lookups.

## 6. Cut permission round-trips
Every permission prompt is an extra turn. Run the **`/fewer-permission-prompts`** skill once to allowlist
the safe commands you use here (`pnpm typecheck`, `git status`, `ls`, read-only `curl`, the seed/Supabase
REST calls). Fewer prompts → fewer turns → fewer tokens.

## 7. Be specific, batch related changes
"Add a column X to expenses, its form field, and the table cell" in one message beats three round-trips.
For anything big/ambiguous, ask Claude to **plan first** (plan mode) so it doesn't build the wrong thing
and redo it.

## 8. Use durable memory, not the transcript, for facts
Stable facts (demo creds, the empty-DB caveat, that the logo can't be ingested from chat) live in these
docs + Claude's memory — so they don't need re-explaining each session. If you correct Claude on something
durable, ask it to "remember that."

## Quick prompts that save tokens
- "Read `docs/<x>.md` only, then …" — scopes the context.
- "Plan this first, don't write code yet." — avoids expensive rework.
- "Use a subagent to find all call sites of `emit`." — keeps main context clean.
- "`/compact`" — when continuing a long task.
- "Start fresh — new task." — for anything unrelated.
