# /explore-roles — Design

**Date:** 2026-08-08
**Repo:** `ai-job-search`
**Status:** approved, ready for planning

## Problem

The toolchain only ever scores or scrapes jobs the candidate already told it to look for:
`search-queries.md` holds a fixed list of role-title and site queries written once at `/setup` time,
`/scrape` runs those queries, `/rank` and `/apply` evaluate what comes back. Nothing looks *outward*
from the candidate's actual skills and experience to surface adjacent role titles or industries the
candidate never thought to search for. A candidate whose search queries under-cover their own market
value has no way to discover that gap short of manually brainstorming new query lines.

## Design

### New command: `/explore-roles`

`.claude/commands/explore-roles.md`, one new command, no arguments.

**Profile:** resolve the active candidate profile per `.claude/PROFILES.md` first, state
`Profile: <name>` in the first line of output, same as every other profile-scoped command.

### Steps

1. **Load candidate context.** Read `profiles/<name>/skills/01-candidate-profile.md` (skills,
   experience, languages) and `profiles/<name>/skills/04-job-evaluation.md` (career goals,
   deal-breakers). Also read `profiles/<name>/skills/search-queries.md` to know the candidate's
   existing city/country/job-board values and which role types are *already* covered, so exploration
   targets the gap rather than repeating existing categories.
2. **Web-research adjacent roles.** WebSearch for job titles and industries that commonly hire people
   with this skill combination — market-grounded, not pure inference from the profile text. This
   catches real category names (e.g. "Solutions Engineer", "Technical Program Manager", "fintech
   backend") that the candidate's own vocabulary might not surface.
3. **Produce lightweight suggestions**, not scored evaluations. For each suggested title or industry:
   - Name
   - Why it fits — skills/experience overlap with the candidate's profile
   - 1-2 example real job titles or postings seen during research, grounding the suggestion in
     something concrete rather than a guess
   - A paste-ready query block in `search-queries.md`'s existing format, using the candidate's
     **actual** city/country/job-board values already found in step 1 (not placeholders):
     ```
     ### [Suggested Role/Industry Name]

     site:[actual job board] "[Suggested Title]" [actual city]
     site:linkedin.com/jobs "[Suggested Title]" [actual country]
     ```
   No 5-dimension scoring (that framework in `04-job-evaluation.md` is for real postings, not
   hypothetical role categories), no eligibility/language gates (those apply once an actual posting
   exists).
4. **Write and present.** Save the full report to
   `profiles/<name>/explore_roles/report_<YYYY-MM-DD>.md`. Print a summary to chat: the list of
   suggestions with their one-line rationale.
5. **Close with the copy-paste instruction:** "Paste any of these blocks into
   `profiles/<name>/skills/search-queries.md` under a new Priority category; `/scrape` picks it up
   next run." No auto-write to `search-queries.md` — the candidate stays the one who decides what
   enters the active search pipeline.

### Non-interference

Read-only against everything except the new report file, which is scoped to the resolved profile's
own directory (`profiles/<name>/explore_roles/`), matching the pattern of `profiles/<name>/upskill/`
and `profiles/<name>/reports/`. No writes to `search-queries.md`, `tracker.csv`, or
`job_scraper/seen_jobs.json`.

## Edge cases

- **No web results for a plausible category** — skip it silently rather than presenting a suggestion
  with no grounding evidence; the report only contains suggestions backed by at least one real
  example title/posting found during research.
- **Suggested title overlaps an existing search-queries.md category** — still include it if research
  surfaces a materially different angle (e.g. a different industry using the same title), but note
  the overlap in the rationale so the candidate doesn't duplicate work.
- **`explore_roles/` directory missing** — create it, same as `/upskill` creates its own output
  directory on first run.

## Out of scope

- Scoring suggestions with the 5-dimension framework — that's for real postings via `/rank`/`/apply`.
- Auto-writing to `search-queries.md` — stays a manual, deliberate step.
- Eligibility or language gating — applies once an actual posting exists, not to hypothetical
  categories.
- Salary or company-list research per suggestion — `/upskill` and `/apply` go deeper once a real
  posting is in play.

## Verification

1. **Report grounding.** Every suggestion in a generated report cites at least one real example
   title/posting found during the web research step — no ungrounded suggestions.
2. **Paste-ready queries.** Query blocks use the candidate's actual city/country/job-board values
   pulled from `search-queries.md`, not literal placeholder text like `[YOUR_CITY]`.
3. **Profile isolation.** Report writes only to `profiles/<name>/explore_roles/`; running for one
   profile does not touch another profile's directory (consistent with the non-interference guarantee
   established in the multi-profile design).
4. **No silent mutation.** After a run, `search-queries.md`, `tracker.csv`, and `seen_jobs.json` are
   byte-identical to before.
