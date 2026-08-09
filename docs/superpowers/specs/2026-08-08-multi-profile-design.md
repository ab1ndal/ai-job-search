# Multi-Profile Support — Design

**Date:** 2026-08-08
**Repo:** `ai-job-search` (fork of `MadsLorentzen/ai-job-search`, upstream remote configured)
**Status:** approved, ready for planning

## Problem

The framework is single-candidate by construction: one candidate profile in root `CLAUDE.md`, one
`job_search_tracker.csv`, one set of personalized skill files, one scraper dedup state. Two people
(Abhinav Bindal, Anushka Jindal) are job-searching for different profile types from this one repo.

Two failure modes if left as-is:

1. **Wrong-person scoring and drafting.** `/rank`, `/apply`, and `/upskill` read
   `01-candidate-profile.md`, `02-behavioral-profile.md`, `04-job-evaluation.md`, and
   `search-queries.md`, all of which `/setup` fills with one person's data.
2. **Merged application history.** One tracker CSV and one `documents/applications/` archive mean
   two unrelated job searches interleave with no way to separate them.

Application tracking itself already exists (`job_search_tracker.csv`, `/outcome`, `/rank`,
`/html-report`) and is not being rebuilt — only partitioned per profile, plus a merged read-only view.

## Constraints

- **Upstream divergence is the dominant cost.** 23 references to `job_search_tracker.csv` across 9
  upstream command/skill files. Editing them means a merge conflict on nearly every upstream update.
  The design must leave those files untouched.
- **Personal data must stay uncommitted.** Existing `.gitignore` patterns are root-relative
  (`documents/cv/**`, `cv/main_*.*`, `job_search_tracker.csv`); they do **not** match paths under
  `profiles/`. Extending the ignore rules is mandatory, not optional.
- **Generated LaTeX depends on relative asset paths** (`cover_letters/OpenFonts/fonts/raleway/`,
  `cover.cls`). Any relocation of those tracked assets breaks compilation and diverges from upstream.

## Design

### Layout

```
active -> profiles/abhinav          # the ONLY mutable symlink; gitignored
profiles/
  abhinav/
    PROFILE.md                      # identity block, @-imported by root CLAUDE.md
    skills/
      01-candidate-profile.md
      02-behavioral-profile.md
      03-writing-style.md
      04-job-evaluation.md
      search-queries.md
    tracker.csv
    documents/
      applications/ postings/ cv/ linkedin/ diplomas/ references/ interview/
    job_scraper/                    # seen_jobs.json, notion_sync.json, scrape reports
  anushka/                          # identical skeleton
```

### Indirection through `active/`

Every root path an upstream command expects becomes a **fixed** symlink that resolves through
`active/`. Switching profiles repoints `active` only — no other symlink changes, so `git status`
stays clean and no churn enters history.

| Root path (upstream expects) | Symlink target |
|---|---|
| `job_search_tracker.csv` | `active/tracker.csv` |
| `documents/applications` | `active/documents/applications` |
| `documents/postings` | `active/documents/postings` |
| `documents/cv` | `active/documents/cv` |
| `documents/linkedin` | `active/documents/linkedin` |
| `documents/diplomas` | `active/documents/diplomas` |
| `documents/references` | `active/documents/references` |
| `documents/interview` | `active/documents/interview` |
| `job_scraper` | `active/job_scraper` |
| `.claude/skills/job-application-assistant/01-candidate-profile.md` | `active/skills/01-candidate-profile.md` |
| `.claude/skills/job-application-assistant/02-behavioral-profile.md` | `active/skills/02-behavioral-profile.md` |
| `.claude/skills/job-application-assistant/03-writing-style.md` | `active/skills/03-writing-style.md` |
| `.claude/skills/job-application-assistant/04-job-evaluation.md` | `active/skills/04-job-evaluation.md` |
| `.claude/skills/job-scraper/search-queries.md` | `active/skills/search-queries.md` |

`documents/README.md` stays a real tracked file. `03-writing-style.md` is per-profile: the two
candidates have different voices, and `/setup` tunes tone per person.

Root `CLAUDE.md` keeps the repo-level instructions and replaces its inline candidate-profile block
with an import of `active/PROFILE.md`, plus the naming rule in the next section.

### What is deliberately NOT split

`cv/` and `cover_letters/` stay real directories. They hold tracked shared assets (`cover.cls`,
`OpenFonts/`, `main_example.tex`, `cover_example.tex`) whose relative paths generated LaTeX depends
on. Isolation comes from **filename prefix** instead:

- `cv/main_<profile>_<company>_<role>.tex`
- `cover_letters/cover_<profile>_<company>_<role>.tex`

Both still match the existing ignore globs (`cv/main_*.*`, `cover_letters/cover_*.*`). The durable
per-person copy lands in `documents/applications/<company>_<role>/`, which is per-profile via
symlink. The rule is documented in root `CLAUDE.md` — a file this fork already owns and customizes —
so no upstream command file is edited. This prevents the concrete hazard of `/apply` reusing the
other candidate's CV when both apply to the same company.

### New commands

Added under `.claude/commands/profile.md`. No upstream command or skill file is modified.

| Invocation | Behavior |
|---|---|
| `/profile` | Print active profile name and, for each profile, counts of open vs final applications |
| `/profile use <name>` | Repoint `active`, then state the new active profile explicitly in the output |
| `/profile new <name>` | Scaffold a profile skeleton from the upstream placeholder templates |
| `/profile status` | Merged table across all `profiles/*/tracker.csv` — read-only, no schema change |

`/profile status` reads each tracker with the canonical status vocabulary already defined in
`.claude/commands/outcome.md` (`drafted | applied | interview | offer | hired | rejected |
no_response | offer_declined | withdrawn`, plus the legacy space spellings accepted on read). It
does not define a second enum.

Unchanged and requiring no edits: `/setup`, `/scrape`, `/rank`, `/apply`, `/outcome`, `/interview`,
`/html-report`, `/gmail-sync`, `/notion-sync`, `/upskill`. Running `/setup` while a profile is active
fills that profile's files, because the symlinks route the writes.

### Git

- `.gitignore` gains `profiles/` and `active`.
- Committed: the fixed symlinks (path text only, no personal data), `/profile` command, gitignore
  additions, `CLAUDE.md` edits, this spec.
- Deleted tracked files: `documents/{applications,cv,diplomas,linkedin,postings,references}/.gitkeep`
  and `job_scraper/.gitkeep`, because those paths become symlinks. Each profile skeleton carries its
  own `.gitkeep` equivalents (untracked, since `profiles/` is ignored).
- Upstream merge cost: conflicts only when upstream edits `01`–`04` or `search-queries.md`.
  Resolution is fixed and documented: keep the symlink, hand-apply the upstream change into every
  `profiles/*/skills/` copy.

## Edge cases

- **Stale active profile.** Every `/profile` invocation prints the active name; `/profile use` states
  the switch explicitly. Mitigation is disclosure, not detection.
- **Broken `active` symlink** (profile dir renamed or deleted): `/profile` detects an unresolvable
  `active` and refuses to run other steps until repointed.
- **Fresh clone.** `active` is gitignored, so a new checkout has no active profile. `/profile new`
  and `/profile use` are the bootstrap path; `/profile` with no `active` present says so.
- **Same company, both candidates.** Filename prefixes keep drafts distinct; archives are already
  per-profile, so `documents/applications/<company>_<role>/` exists independently under each.
- **`tools/security_guards.py`** resolves the tracker path — it must tolerate a symlinked path.
  Verified during implementation before completion is claimed.

## Out of scope

- Merging the two trackers into one CSV with a `profile` column (rejected: changes the schema all 9
  upstream files read).
- Editing `/html-report` for a two-profile dashboard (the merged view lives in `/profile status`).
- Parallel work in two terminals with different active profiles (would require git worktrees; the
  single-pointer model is explicitly one-active-at-a-time).
- Committing any personal data.

## Verification

1. **Switch test.** `/profile use anushka` → every root path in the symlink table resolves under
   `profiles/anushka` (`readlink -f` on each).
2. **Leak test.** Scaffold both profiles, write a fake tracker row and a fake `cv/main_abhinav_x_y.tex`,
   then `git status --porcelain` must be empty.
3. **Round-trip test.** Write a row to `profiles/abhinav/tracker.csv`, switch to `anushka`, confirm
   `job_search_tracker.csv` does not show it, switch back, confirm it returns.
4. **Broken-pointer test.** Remove `active`; `/profile` reports the condition instead of failing
   obscurely.
5. **Guard test.** `tools/security_guards.py` runs clean against the symlinked tracker path.
6. **Merged view test.** Rows in both trackers appear in `/profile status` labelled by profile, with
   open vs final classified per the `/outcome` vocabulary.
