# Profile Resolution

This repo serves two candidates. Every command that touches candidate data resolves exactly one
profile first, and reads and writes only inside that profile's directory. This file is the single
definition of that rule - commands link here instead of restating it.

## Resolution order

1. An explicit `--profile <name>` argument on the invocation. It applies to that invocation only and
   never changes `.active-profile`.
2. The single line in `.active-profile` at the repo root.
3. Neither present -> stop. List the directories under `profiles/` and tell the user to run
   `/profile use <name>`. Do not read or write anything.

State the resolved profile name in the **first line of output**, e.g. `Profile: abhinav`. A
wrong-profile run must be visible before any document is drafted, not after.

## Profile paths

All paths are relative to the repo root, with `<name>` replaced by the resolved profile.

| What | Path |
|---|---|
| Application tracker CSV | `profiles/<name>/tracker.csv` |
| Personalized skill files | `profiles/<name>/skills/` |
| Generated CVs | `profiles/<name>/cv/` |
| Generated cover letters | `profiles/<name>/cover_letters/` |
| Application archive | `profiles/<name>/documents/applications/` |
| Saved postings | `profiles/<name>/documents/postings/` |
| Source CV, LinkedIn export, diplomas, references | `profiles/<name>/documents/{cv,linkedin,diplomas,references}/` |
| Interview material | `profiles/<name>/documents/interview/` |
| Scraper state | `profiles/<name>/job_scraper/` (`seen_jobs.json`, `notion_sync.json`, scrape reports) |
| Identity block | `profiles/<name>/PROFILE.md` |

The five personalized skill files live in `profiles/<name>/skills/`:
`01-candidate-profile.md`, `02-behavioral-profile.md`, `03-writing-style.md`,
`04-job-evaluation.md`, `search-queries.md`.

Read them from there, never from their repo-root copies. The root copies under
`.claude/skills/` are untouched placeholder masters that `/profile new` copies from.

## Shared, never profile-scoped

`cv/main_example.tex`, `cover_letters/cover_example.tex`, `cover_letters/cover.cls`,
`cover_letters/OpenFonts/`, `templates/`, `documents/README.md`. These are templates and assets,
identical for every candidate, and they stay at the repo root.

## Error behavior

- Unknown profile name: hard error listing the valid names. **Never** fall back to another profile
  or to a default - drafting one candidate's application from the other's data is the exact failure
  this design exists to prevent.
- `profiles/<name>/` exists but a required file is missing: say which file, and point at
  `/profile new` or `/setup`. Do not create a partial profile silently.
- Broken or empty `.active-profile`: treat as absent and follow step 3 of the resolution order.

## Non-interference

Every mutable artifact lives inside `profiles/<name>/`. No command writes a path another profile
reads. Switching writes one line to `.active-profile` and nothing else, so a switch cannot half
complete.
