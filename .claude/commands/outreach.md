# /outreach - Track and Draft Networking Outreach to Contacts and Hiring Managers

Applying cold is only half the game - a warm introduction or a direct message to the hiring manager often works better than the application alone. `/outreach` tracks who you already know at target companies (imported from your LinkedIn connections export), finds hiring managers you don't know via public web search, and drafts outreach messages. It never sends anything.

`/outcome followup` chases a *submitted application* that has gone quiet. `/outreach` is the step before that - networking into a company, known contact or cold, before or independent of an application existing.

Follow these steps **in order**.

---

## Step 0: Resolve Profile and Parse Input

Resolve the active candidate profile per `.claude/PROFILES.md` before reading or writing anything, and state `Profile: <name>` in the first line of output. `<name>` in every path below is that resolved profile.

`$ARGUMENTS` may contain:

- `import` → enter the import branch (Step 1)
- A company name, e.g. `/outreach acme` → enter the company lookup branch (Step 2) for that company
- Nothing → read `profiles/<name>/tracker.csv`, list every company that has zero rows in `profiles/<name>/contacts.csv` for that company, and ask which to work on. If every tracker company already has at least one contact row, say so and ask if the user wants to re-run lookup on a specific one anyway (new hiring managers may have shown up since).

---

## Step 1: Import LinkedIn Connections (`/outreach import`)

1. Ask the user for the path to their LinkedIn connections export CSV (Settings & Privacy → "Get a copy of your data" → Connections; the user generates and downloads this themselves - this command never fetches it for them).
2. Read the CSV and parse headers **by name**, not position: `First Name`, `Last Name`, `Company`, `Position`, and `URL` if present. LinkedIn has changed this export's schema before, so a missing `URL` column leaves `linkedin_url` blank rather than failing the import.
3. Read `profiles/<name>/tracker.csv` for the list of companies to match against. If it does not exist or has zero rows, stop and tell the user to add target companies first (via `/apply` or a manual tracker row) - there is nothing to match connections to yet.
4. Normalize company strings on both sides before comparing: lowercase, strip trailing legal suffixes (`inc`, `inc.`, `llc`, `corp`, `corporation`, `ltd`, `co`, `company`), and collapse extra whitespace. This normalization is for comparison only, never for storage: `profiles/<name>/tracker.csv`'s spelling of the company is always canonical. Every write to `profiles/<name>/contacts.csv`'s `company` column uses the tracker's exact spelling (e.g. `Meta`, not the export's `Meta Platforms`), never the export's or a web-search result's spelling.
   - **Exact normalized match** (e.g. export "Meta" vs tracker "Meta") → add to `profiles/<name>/contacts.csv` automatically: `company` = the tracker's spelling, `name` = `First Name` + `Last Name`, `title` = `Position`, `relation=connection`, `source=linkedin_export`, `channel` left blank (set on drafting), `status=not_contacted`, `last_contacted` blank, `notes` blank.
   - **Partial/substring-only match** (e.g. export "Meta Platforms" vs tracker "Meta") → do not add automatically. Collect these separately and present them to the user after the full pass, as "possible matches - add these?" Add only the ones the user confirms, and when added, write `company` as the tracker's spelling, not the export's.
5. Before adding any row, check `profiles/<name>/contacts.csv` for an existing row with the same normalized `(company, name)`. If found, skip and count it as a duplicate - never add a second row for the same person at the same company.
6. If `profiles/<name>/contacts.csv` does not exist yet, create it with the header: `company,name,title,relation,source,linkedin_url,channel,status,last_contacted,notes`.
   **CSV quoting rule:** any field written to `profiles/<name>/contacts.csv` - here or anywhere else this file is written - that contains a comma, double quote, or newline must be quoted per standard CSV convention (wrap the field in double quotes, double any embedded double quote). Never write a raw newline into a field. `Position` values from the LinkedIn export (e.g. `Engineering Manager, Platform Infrastructure`) and dictated `notes` text routinely contain commas and must be quoted on write; an unquoted comma silently shifts every later column.
7. Report a summary: `N matched and added`, `N possible matches pending confirmation` (list them), `N skipped as duplicate`.
8. This step is idempotent - re-running `import` with a freshly re-exported CSV only adds genuinely new matches; everything already tracked is skipped as a duplicate.

---

## Step 2: Look Up a Company (`/outreach <company>`)

1. Read `profiles/<name>/contacts.csv` and match the given company name against the `company` column using the same normalization rule as Step 1.4 (lowercase, strip trailing legal suffixes, collapse whitespace) - not a weaker case-insensitive-only comparison, so a run started from `/outreach acme` and a run started from `/outreach acme inc` find the same rows. Show every existing row for that company as a table: name, title, relation, status, last_contacted.
2. For any row at `status=messaged`, ask: "Hear back from `<name>` yet?" If the user reports a reply, update that row's `status` to `replied`, `intro_made`, or `no_response` per what they describe, and append a dated line to `notes` (e.g. `replied 2026-08-08: <one-line summary>`).
3. Always run a web-search pass as well, even when Step 2.1 already found rows - it may surface a hiring manager the export didn't have, a new contact, or a title update for someone already tracked. Search:
   - The job posting itself, if the company has an open tracker row with a `source` URL (recruiter or hiring-manager byline is sometimes named directly in the posting).
   - The company's public LinkedIn "People"/team page.
   - A direct search: `"<company> hiring manager <role or team, if known>"`.
   Use only public sources - no logged-in LinkedIn browsing, no scraping behind a login wall.
4. Present any search hits with name, title, and LinkedIn URL (if found), plus the source query that surfaced them. **Never auto-add.** Ask the user which, if any, to save:
   - A hit that matches an existing `profiles/<name>/contacts.csv` row (same normalized `(company, name)`) - offer to update that row's `title` or append a note, not create a duplicate.
   - A genuinely new hit the user confirms - add with `company` = `profiles/<name>/tracker.csv`'s spelling for that company (never the search result's spelling), `relation=hiring_manager`, `source=web_search`, `channel` blank, `status=not_contacted`.
5. If the web search turns up nothing, say so plainly. Never invent a name, title, or LinkedIn URL to fill the gap.
6. For every row now at `status=not_contacted` (existing or just confirmed), ask if the user wants a draft written now (Step 3). Skip any the user doesn't want to draft for yet - not every contact needs outreach in the same session.

---

## Step 3: Draft Outreach

For each contact the user selects for drafting:

1. **Gather claim sources.** Check for an archived CV at `profiles/<name>/documents/applications/<company>_*/cv_draft.tex` for this company (an application may already exist even if outreach hasn't happened yet). If found, use it as the primary source for concrete value claims. Otherwise fall back to `profiles/<name>/PROFILE.md`. If neither source supports a specific claim the draft would otherwise make, omit that claim - never invent it.
2. **Apply tone rules** from `profiles/<name>/skills/03-writing-style.md` (no cliches, no em-dashes, warm but direct, match the register the candidate actually writes in).
3. **Shape by relation and connection state:**
   - **`relation=connection`** (a person the candidate already knows): warm tone, roughly **60 to 120 words** (matching the hiring-manager-DM length below). Reference the shared context available from the row (`title`, `company`). State interest in opportunities at the company, then ask if they're open to a quick chat or can point to the right person. Never opens with a direct "can you refer me" - that is the second message, not the first, and only if the user reports back that the contact is receptive.
   - **`relation=hiring_manager`, not yet connected**: a LinkedIn connection-request note, hard cap **300 characters**. Name the specific role (from the company's open tracker row if one exists, otherwise the general area the candidate is targeting), one concrete qualifying line, low-pressure close.
   - **`relation=hiring_manager`, already connected**: a DM in the same shape as `/outcome followup`'s note - **60 to 120 words**, one interest line, one concrete value line sourced per Step 3.1, one specific ask (a short chat, or advice on how to get considered for the role). No "just checking in" filler. Determine "already connected" only by explicitly asking the user ("Are you already connected to `<name>` on LinkedIn?"). **Never infer this from `channel`** - that value means a connection request was *sent*, not accepted, and picking this branch on that alone would wrongly skip the connection-request note for someone who never accepted.
4. Present the draft and iterate with the user until they're happy. If the user asks for a different channel (e.g. email instead of LinkedIn DM) and an email address was shared during this conversation, redraft for that channel; otherwise say the channel isn't available for this contact. `profiles/<name>/contacts.csv` has no email column and is never a source of an email address - email as a channel only works when the user provides one directly, in the current conversation.
5. **Draft only, never send.** This command produces text for the user to send themselves. It never emails, messages, or submits anything on their behalf, and must not be wired to any tool that does.

---

## Step 4: Log the Outreach

Once the user confirms they will send the draft (or have already sent it) - in the same turn, since an unlogged send breaks the next run's "hear back yet?" check in Step 2.2:

1. Update the contact's row in `profiles/<name>/contacts.csv`:
   - `status` → `messaged`
   - `channel` → whichever was drafted: `connection_request`, `linkedin_dm`, or `email`
   - `last_contacted` → today's date
   - Append `messaged YYYY-MM-DD` to `notes` (append, never overwrite prior notes)
2. Save the final sent text to `profiles/<name>/documents/contacts/<company>/<name>_YYYY-MM-DD.md`, creating the `profiles/<name>/documents/contacts/<company>/` directory if it does not already exist.
3. If the user decides not to send it, log nothing and leave the row at `status=not_contacted`.

---

## Step 5: Confirm

Applies to the company-lookup branch (Steps 2-4) only - the import branch (Step 1) has its own summary (Step 1.7) and does not also emit this block.

Summarize what happened this run:

> **Outreach updated for `<Company>`.**
>
> - `profiles/<name>/contacts.csv`: `<N>` row(s) added, `<N>` updated, `<N>` drafted and logged as `messaged`.
> - Archived: `profiles/<name>/documents/contacts/<company>/<name>_YYYY-MM-DD.md` for each sent draft.
> - Still `not_contacted` and not drafted this run: `<list, if any>`.

---

## Important Rules

1. **Draft only, never send.** No tool call in this command may email, message, or submit anything on the user's behalf.
2. **Never fabricate.** Every claim in a draft traces to the archived CV or `PROFILE.md`; every hiring-manager suggestion traces to a cited public web-search result. No source, no claim.
3. **No logged-in LinkedIn automation or scraping.** Hiring-manager discovery uses public sources only.
4. **Company matching is conservative.** Exact normalized match auto-adds on import; anything looser requires explicit user confirmation, to avoid attaching the wrong person to the wrong company.
5. **Dedup on `(company, name)`.** Never create a second row for someone already tracked at that company - update the existing row instead.
6. **Idempotent.** Re-running `import` after a fresh export, or re-running the company lookup branch, only adds what's genuinely new.
7. **Never restructure `profiles/<name>/contacts.csv`.** Append rows and notes; never reorder or rewrite existing rows outside the specific fields Step 2 and Step 4 update.
