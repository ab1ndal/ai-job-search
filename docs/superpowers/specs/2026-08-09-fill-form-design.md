# /fill-form — Browser-Driven Application Form Assistant — Design Spec

**Date:** 2026-08-09
**Status:** Approved, pending implementation plan

## Problem

`.claude/skills/job-application-assistant/08-application-forms.md` already
drafts the free-text content many application portals ask for (self-intro,
motivation, project entries) into a `.txt` file the candidate copies from
by hand. It stops there — the candidate still has to open the portal,
paste each field manually, upload the right PDF, click through however
many pages the portal has, and submit. That's mechanical, repetitive, and
error-prone (wrong file uploaded, a field left blank, a stale draft pasted
by mistake). This feature drives the browser through that process,
proposing values per field from the candidate's own data and drafted
content, with the candidate steering every page and approving every value
before anything is typed or clicked.

## Goals

- A new command, `/fill-form <url>`, that opens the target application
  form in a real browser and, page by page: shows the candidate what
  fields it found, proposes a value for each from their profile or
  already-drafted form content, waits for approval/edits, fills the
  approved values, advances to the next page, and repeats.
- File-upload fields (resume/CV, cover letter) auto-matched to the
  tailored PDFs `/apply` already produces, shown to the candidate before
  upload.
- On confirmed final submission, update the tracker row for this
  application from `drafted` to `applied` with the real submission date —
  the same transition `/outcome` already performs, just triggered by the
  moment it's known to have actually happened.
- **Every user-gated step is flagged and left to the user to resolve.**
  This is the feature's core safety property, not an implementation
  detail: a login wall, a CAPTCHA, an ambiguous or unrecognized field, and
  the final Submit click are all points where the assistant stops and
  hands control to the human — it never attempts to solve, guess through,
  or click past any of them itself.

## Non-Goals

- Not a general-purpose browser automation tool. Scope is limited to
  filling and (with explicit per-instance confirmation) submitting one
  application form the candidate is actively driving.
- Not a CAPTCHA solver or login-wall bypass. Encountering either is a
  stop-and-flag condition, never a challenge to work around.
- Not a replacement for `08-application-forms.md`'s drafting logic — this
  feature consumes that file's output where it exists and falls back to
  drafting live using the same rules, but doesn't change how that content
  is written.
- Does not run unattended. There is no "fill and submit everything, tell
  me when it's done" mode — every page's proposed values need explicit
  approval, and Submit always needs an explicit, separate confirmation.

## Architecture

Follows the repo's existing CLI-skill convention (see
`.agents/skills/linkedin-search/`): a new skill directory
`.agents/skills/form-filler/cli/src/cli.ts` (bun + TypeScript + Playwright)
exposes browser-control subcommands. A new command,
`.claude/commands/fill-form.md`, orchestrates the page-by-page loop by
invoking that CLI via `Bash`, the same way `/scrape` invokes the portal
search CLIs.

```
/fill-form <url>
  │
  ├─ resolve profile per .claude/PROFILES.md
  ├─ locate company/role context: match <url> or ask the candidate which
  │  tracked application this is, to find the tailored CV/cover letter/
  │  form-text files
  │
  └─ per-page loop:
       1. cli snapshot <url-or-current-page>  → accessibility tree +
          screenshot path
       2. Claude reads the tree: detect login wall / CAPTCHA / form
          fields / a "Submit" or final-page marker
       3. login wall or CAPTCHA detected → STOP, tell the candidate,
          wait for them to resolve it and say "done" before re-snapshotting
       4. otherwise, for each detected field: propose a value (see Field
          Sourcing) and present a field → proposed-value table
       5. candidate approves / edits / flags "I don't know" per field
       6. cli fill <field-map.json>  (text fields)
          cli upload <field-selector> <file-path>  (file fields)
       7. cli click <next-button-selector>  → advances the page, UNLESS
          this was the final page's Submit button, which is never clicked
          without a separate explicit confirmation step (see Submit Gate)
       8. repeat from step 1 on the new page
```

### CLI subcommands (`.agents/skills/form-filler/cli/src/cli.ts`)

- `snapshot <url>` — navigates if given a URL (first call) or reads the
  current page (subsequent calls); prints the accessibility tree (form
  fields, labels, buttons) as structured JSON, plus a screenshot file path
  for visual reference when the tree alone is ambiguous.
- `fill <field-map.json>` — takes `{selector: value}` pairs, types each
  value into its field using Playwright's fill API (never simulated
  keystrokes that could trigger unintended side effects).
- `upload <selector> <file-path>` — sets a file-input field via
  Playwright's `setInputFiles`.
- `click <selector>` — clicks a button/link (Next, Continue). Does not
  distinguish "Submit" specially — the command-level orchestration in
  `fill-form.md` is responsible for never calling `click` on a
  Submit-labeled control without the explicit confirmation described
  below.
- The browser session persists across subcommand invocations within one
  `/fill-form` run (a running Playwright process the CLI attaches to, not
  a fresh browser per subcommand) — page state, cookies, and any manual
  login the candidate performed carry forward.

## Field Sourcing

| Field type | Source |
|---|---|
| Name, email, phone, address, education, work history | `profiles/<name>/skills/01-candidate-profile.md` and `profiles/<name>/PROFILE.md` |
| Self-intro, motivation, project entries, other free-text | The company's existing `.txt` file from `08-application-forms.md`'s output, if one exists for this company/role. If none exists, draft the content live following `08-application-forms.md`'s rules (same grounding requirement: every claim traceable to `01-candidate-profile.md` + master CV + `PROFILE.md`) |
| Resume/CV upload | `profiles/<name>/cv/main_<company>_<role><CV_EXT>` compiled PDF, matched by the same naming convention `/apply` writes — shown to the candidate for confirmation before upload, never uploaded silently |
| Cover letter upload | `profiles/<name>/cover_letters/cover_<company>_<role><COVER_EXT>` compiled PDF, same confirmation rule |
| Field Claude cannot confidently map to any source | Flagged to the candidate as unrecognized; never guessed |

## User-Gated Stop Conditions

Every one of these is a hard stop — the assistant surfaces what it found
and waits; it never attempts a workaround:

- **Login wall.** Detected by a password field with no application-form
  fields alongside it. Candidate logs in manually in the visible browser
  window, then tells the assistant to continue.
- **CAPTCHA / bot-challenge.** Detected by presence of a CAPTCHA widget or
  a page that otherwise looks like a challenge rather than a form.
  Candidate resolves it manually; the assistant does not attempt to solve,
  guess, or script around it under any circumstance.
- **Unrecognized or ambiguous field.** A field the snapshot detects but
  that doesn't map cleanly to any Field Sourcing row, or where two
  plausible values conflict. Ask the candidate rather than pick one.
- **Final Submit.** Never clicked as part of the normal page-advance flow
  in step 7 above. Once the assistant believes it has reached the last
  page with only a Submit-labeled control remaining, it shows the full set
  of values about to be submitted and asks for an explicit, separate
  "yes, submit" before running `cli click` on that control. This mirrors
  the standing rule that outward-facing, hard-to-reverse actions get
  confirmed per instance, not pre-authorized.

## Tracker Integration

On confirmed submission:

1. Resolve the tracker row for this company/role in
   `profiles/<name>/tracker.csv`, matched case-insensitively the same way
   `/apply` Step 6b and `/outcome` do.
2. If a row exists with status `drafted` (written by `/apply` when the CV
   and cover letter were originally drafted): advance `status` to
   `applied` and overwrite `date` with today — the actual submission date,
   per the existing rule (documented in `/outcome`) that the draft date is
   not the send date and must not be left in place once a real submission
   date is known.
3. If no matching row exists (the candidate ran `/fill-form` without
   `/apply` having drafted anything for this posting first — e.g. filling
   out a form for an application made entirely outside the workflow):
   append a new row directly with status `applied` and today's date, same
   header and column conventions as `/apply` Step 6b.
4. Never restructure the CSV, reorder rows, or touch any other row — same
   discipline `/outcome` already follows.

## Error Handling

- **Script/selector failure** (element not found, page didn't navigate as
  expected): surface the actual error to the candidate. Never retry
  silently, never guess an alternate selector.
- **Snapshot detects nothing fillable on a page that isn't the final
  page**: likely a multi-step portal with an intermediate informational
  page — show the candidate the screenshot and ask how to proceed, rather
  than assuming an error.
- **File upload target missing** (no matching tailored CV/cover letter
  found for this company/role): tell the candidate no matching file was
  found and ask them to either point at a file or run `/apply` first.

## Files Touched

- `.agents/skills/form-filler/cli/src/cli.ts` (+ supporting files under
  `.agents/skills/form-filler/cli/`) — new Playwright-backed CLI,
  `snapshot`/`fill`/`upload`/`click` subcommands.
- `.agents/skills/form-filler/SKILL.md` — skill manifest, same shape as
  `linkedin-search/SKILL.md`, with a scoped `allowed-tools: Bash(bun run
  .agents/skills/form-filler/cli/src/cli.ts *)` entry.
- `.claude/commands/fill-form.md` — new command orchestrating the
  per-page loop described above.

## Testing Notes

Unlike the fit-ranking feature, this one has real executable code (the
CLI), so it gets real tests in addition to manual command-flow tracing:

- CLI subcommands: unit/integration tests against a local static HTML
  fixture form (no network dependency) covering: snapshot correctly
  identifies text fields, file-upload fields, and a submit button;
  fill correctly types values; upload correctly sets a file input; click
  correctly navigates.
- Login-wall and CAPTCHA detection heuristics: tested against fixture
  pages that simulate each, confirming the command stops rather than
  proceeding.
- `fill-form.md`'s command-level logic (field sourcing, tracker
  transition, stop conditions) verified the same way the fit-ranking
  feature was: manual worked-example traces through the prose, since that
  part is markdown-driven, not code.
