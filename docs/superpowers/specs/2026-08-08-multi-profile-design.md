# Multi-Profile Support — Design

**Date:** 2026-08-08
**Repo:** `ai-job-search` (fork of `MadsLorentzen/ai-job-search`)
**Status:** approved, ready for planning
**Revision:** rev 2 — upstream sync abandoned, symlink indirection replaced with explicit paths

## Problem

The framework is single-candidate by construction: one candidate profile in root `CLAUDE.md`, one
`job_search_tracker.csv`, one set of personalized skill files, one scraper dedup state. Two people
(Abhinav Bindal, Anushka Jindal) run different job searches from this one repo.

Two failure modes if left as-is:

1. **Wrong-person scoring and drafting.** `/rank`, `/apply`, and `/upskill` read
   `01-candidate-profile.md`, `02-behavioral-profile.md`, `03-writing-style.md`,
   `04-job-evaluation.md`, and `search-queries.md` — all filled by `/setup` with one person's data.
2. **Merged application history.** One tracker CSV and one `documents/applications/` archive mean
   two unrelated job searches interleave with no way to separate them.

Application tracking itself already exists (`job_search_tracker.csv`, `/outcome`, `/rank`,
`/html-report`) and is not being rebuilt — only partitioned per profile, plus a merged read-only view.

## Constraints

- **No upstream sync.** This fork will not merge from `MadsLorentzen/ai-job-search` again, so
  divergence from upstream files carries no cost. Explicit rewriting of paths is therefore preferred
  over indirection.
- **Personal data must stay uncommitted.** Existing `.gitignore` patterns are root-relative
  (`documents/cv/**`, `cv/main_*.*`, `job_search_tracker.csv`) and do **not** match paths under
  `profiles/`. `tools/security_guards.py` asserts that ignore list, so it must be updated in lockstep
  or it will pass while personal data is exposed.
- **Generated LaTeX depends on asset paths** (`cover.cls`, `cover_letters/OpenFonts/fonts/…`).
  Moving generated documents into profile directories changes those relative paths, so the compile
  invocation must be re-specified and re-verified by an actual test compile.

## Design

### Layout

```
.active-profile                     # one line: the active profile name; gitignored
profiles/
  abhinav/
    PROFILE.md                      # identity block, @-imported by root CLAUDE.md
    skills/
      01-candidate-profile.md
      02-behavioral-profile.md
      03-writing-style.md
      04-job-evaluation.md
      search-queries.md
    tracker.csv                     # replaces root job_search_tracker.csv
    cv/                             # generated tailored CVs
    cover_letters/                  # generated tailored cover letters
    documents/
      applications/ postings/ cv/ linkedin/ diplomas/ references/ interview/
    job_scraper/                    # seen_jobs.json, notion_sync.json, scrape reports
  anushka/                          # identical skeleton
```

Everything under `profiles/` is untracked. Shared, tracked, and unchanged at the repo root:
`cover_letters/cover.cls`, `cover_letters/OpenFonts/`, `cover_letters/cover_example.tex`,
`cv/main_example.tex`, `templates/`, `documents/README.md`.

Root `CLAUDE.md` keeps the repo-level instructions and **drops the inline candidate-profile block
entirely** — it carries no person's data. It cannot `@import` the active profile, because
`CLAUDE.md` is auto-loaded with a fixed path and would pin one candidate into every session
regardless of `.active-profile`. Instead it points at `.claude/PROFILES.md` (the resolution rule),
and the profile data is read at runtime from `profiles/<name>/` by whichever command or skill needs
it. That keeps exactly one candidate's data in context per operation.

### Profile resolution — defined once

A new file `.claude/PROFILES.md` is the single definition of how any command resolves a profile.
Every edited command links to it rather than restating the rule (mirroring how `/outcome` owns the
tracker status enum).

Resolution order:

1. An explicit `--profile <name>` argument on the invocation.
2. The name in `.active-profile`.
3. Neither present → list `profiles/*/` and stop with an instruction to run `/profile use <name>`.

An unknown or non-existent profile name is an error, never a silent fallback to the other profile.
Every command that resolves a profile states the resolved name in its first line of output, so a
wrong-profile run is visible immediately rather than after a CV is drafted.

Derived paths, all relative to `profiles/<name>/`: `tracker.csv`, `skills/`, `cv/`,
`cover_letters/`, `documents/…`, `job_scraper/`.

### Files to edit

18 files carry profile-scoped paths (~136 reference sites). All get rewritten to the
`profiles/<name>/…` form:

| Area | Files |
|---|---|
| Commands | `apply.md`, `reset.md`, `outcome.md`, `notion-sync.md`, `expand.md`, `gmail-sync.md`, `interview.md`, `rank.md`, `html-report.md`, `add-template.md`, `setup.md` |
| Skills | `upskill/SKILL.md`, `job-scraper/SKILL.md`, `job-application-assistant/SKILL.md`, `05-cv-templates.md`, `06-cover-letter-templates.md`, `08-application-forms.md` |
| Code | `tools/security_guards.py` |

`job-application-assistant/SKILL.md` additionally routes the personalized files
(`01`, `02`, `03`, `04`) to `profiles/<name>/skills/`. The repo-root copies of those five files stay
in place as the untouched placeholder templates that `/profile new` copies from; nothing reads them
at runtime.

`tools/security_guards.py` holds no path I/O — it asserts a required `.gitignore` rule list. Its
change is additive: `profiles/`, `.active-profile`, and the existing root rules retained as
defense in depth.

### LaTeX compilation

Generated documents move into `profiles/<name>/{cv,cover_letters}/` while `cover.cls` and the
bundled fonts stay at the repo root. Compiles run **from the repo root**:

```
lualatex -output-directory=profiles/<name>/cv \
         profiles/<name>/cv/main_<company>_<role>.tex

TEXINPUTS=./cover_letters: xelatex -output-directory=profiles/<name>/cover_letters \
         profiles/<name>/cover_letters/cover_<company>_<role>.tex
```

The `\fontspec[Path = …]` string in generated letters becomes
`cover_letters/OpenFonts/fonts/raleway/` (relative to the repo-root working directory), replacing the
current `OpenFonts/fonts/raleway/`. This is documented in `06-cover-letter-templates.md`.

**This is the riskiest part of the design.** It is validated by an actual test compile of both a CV
and a cover letter before implementation is called done. Documented fallback if `TEXINPUTS` or
`-output-directory` misbehaves: copy `cover.cls` and `OpenFonts/` into each profile's
`cover_letters/` (a few MB, untracked) and compile from inside that directory with the upstream
path strings unchanged.

### New command: `/profile`

`.claude/commands/profile.md`, the only new command:

| Invocation | Behavior |
|---|---|
| `/profile` | Print active profile and, per profile, counts of open vs final applications |
| `/profile use <name>` | Write `.active-profile`, echo the new active profile |
| `/profile new <name>` | Scaffold the skeleton, copying the repo-root placeholder templates into `profiles/<name>/skills/` |
| `/profile status` | Merged table across all `profiles/*/tracker.csv`, labelled by profile |

`/profile status` reuses the status vocabulary defined in `.claude/commands/outcome.md`
(`drafted | applied | interview | offer | hired | rejected | no_response | offer_declined |
withdrawn`, plus the legacy space spellings accepted on read). It does not define a second enum.

### Git

- `.gitignore` gains `profiles/` and `.active-profile`; existing root rules stay.
- Deleted tracked files: none. `documents/*/.gitkeep` and `job_scraper/.gitkeep` remain, since those
  root directories are no longer written to but stay as structural documentation alongside
  `documents/README.md`.
- Committed: the 18 edited files, `.claude/PROFILES.md`, `.claude/commands/profile.md`, gitignore
  additions, `CLAUDE.md` edits, this spec.

### Non-interference guarantee

Every mutable artifact is inside `profiles/<name>/`: tracker, generated CVs and cover letters,
application archive, postings, scraper dedup state, and the five personalized skill files. The only
shared things are immutable: `cover.cls`, the bundled fonts, the placeholder templates, and the
command/skill instructions themselves. No command writes to a path that another profile reads.

Switching is one command — `/profile use anushka` — which writes a single line to `.active-profile`
and nothing else. A one-off run against the other profile needs no switch at all: `--profile
anushka` on the invocation. Since only that one file changes, a switch can never leave half a
profile behind.

## Edge cases

- **Wrong profile active.** Every profile-resolving command prints the resolved profile name first;
  `--profile` overrides without changing `.active-profile`.
- **Missing `.active-profile`** (fresh clone — it is gitignored): commands list available profiles
  and stop. `/profile use` is the bootstrap.
- **Unknown profile name:** hard error listing valid names. Never falls back.
- **Same company, both candidates:** fully separate directories and archives, no collision.
- **A missed reference site** silently reads or writes a root path. Caught by the audit test below,
  which is part of the definition of done.

## Out of scope

- Merging trackers into one CSV with a `profile` column (per-profile CSVs stay the source of truth).
- A combined HTML dashboard in `/html-report` (the merged view lives in `/profile status`).
- Running two profiles concurrently in one command invocation.
- Committing any personal data.
- Migrating existing data: there is none — `/setup` has not been run and no tracker exists.

## Verification

1. **Path audit.** Grep the 18 edited files for surviving root-relative profile-scoped references
   (`job_search_tracker.csv`, `documents/applications`, `job_scraper/`, `cv/main_`,
   `cover_letters/cover_`) outside the allowed shared-asset list. Result must be empty. This test is
   kept in the repo and re-runnable, not a one-off grep.
2. **Leak test.** Scaffold both profiles, write a fake tracker row and a fake generated CV, then
   `git status --porcelain` must be empty, and `python tools/security_guards.py` must exit 0.
3. **Resolution test.** With `.active-profile` = `abhinav`, a tracker read resolves to
   `profiles/abhinav/tracker.csv`; `--profile anushka` resolves to Anushka's without mutating
   `.active-profile`; an unknown name errors.
4. **Compile test.** A CV compiles to exactly 2 pages and a cover letter to exactly 1 page from
   `profiles/<name>/`, with fonts embedded — verified by reading the produced PDFs, per the
   verification checklist in root `CLAUDE.md`.
5. **Merged view test.** Rows in both trackers appear in `/profile status`, labelled by profile, with
   open vs final classified per the `/outcome` vocabulary.
6. **No-profile test.** With `.active-profile` absent and no `--profile`, a command lists profiles
   and stops instead of writing anywhere.
