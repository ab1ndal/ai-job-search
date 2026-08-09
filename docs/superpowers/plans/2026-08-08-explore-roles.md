# /explore-roles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `/explore-roles` command that surfaces adjacent role titles and industries beyond the candidate's existing `search-queries.md` categories, grounded in web research, with paste-ready query blocks the candidate can copy into their search pipeline.

**Architecture:** One new prompt-spec file, `.claude/commands/explore-roles.md`, following the existing command pattern (`rank.md`, `apply.md`): resolve profile → read candidate context → WebSearch for adjacent roles → write a report file under the resolved profile's own directory → print a summary. No code, no new dependencies — this is a Claude-executed instruction file, verified the same way every other command spec in this repo is verified: profile-path audit test + a manual dry run against real profile data.

**Tech Stack:** Markdown command spec (Claude Code slash command), Python/pytest for the existing path-audit test suite (`tests/test_profile_paths.py`).

## Global Constraints

- Every command that touches candidate data resolves the active profile per `.claude/PROFILES.md` and states `Profile: <name>` in the first line of output.
- All mutable output goes under `profiles/<name>/...` — never a root-relative path. `tests/test_profile_paths.py`'s `test_unregistered_specs_have_no_candidate_paths` scans every `.md` under `.claude/` not already in `CONVERTED_FILES` and fails on forbidden root-relative patterns (e.g. bare `reports/`, `upskill/report`, `job_scraper/`), so the new file must use `profiles/<name>/explore_roles/...` throughout, not a bare `explore_roles/...` or another command's reserved directory name.
- No fabricated content: every suggestion must cite a real example title/posting found via WebSearch. Never invent job titles, companies, or URLs (same rule `upskill/SKILL.md` states for learning resources).
- No auto-write to `search-queries.md`, `tracker.csv`, or `job_scraper/seen_jobs.json` — this command is read-only against every existing profile artifact except its own new report directory.

---

### Task 1: Create `.claude/commands/explore-roles.md`

**Files:**
- Create: `.claude/commands/explore-roles.md`

**Interfaces:**
- Consumes: `.claude/PROFILES.md` resolution rule (existing); `profiles/<name>/skills/01-candidate-profile.md`, `profiles/<name>/skills/04-job-evaluation.md`, `profiles/<name>/skills/search-queries.md` (existing, read-only).
- Produces: `profiles/<name>/explore_roles/report_<YYYY-MM-DD>.md` (new artifact type, read by no other command — this is the leaf of the chain, symmetric with `profiles/<name>/upskill/report-*.md`).

- [ ] **Step 1: Write the command file**

Create `.claude/commands/explore-roles.md` with this exact content:

````markdown
# /explore-roles - Surface Adjacent Roles and Industries Beyond Your Search Queries

`/scrape` only finds jobs matching the fixed query categories already written in `search-queries.md`. `/explore-roles` looks outward from the candidate's actual skills and experience to surface role titles and industries the candidate never thought to search for - market-grounded suggestions, not a guess from the profile text alone.

`/explore-roles` produces **lightweight suggestions**, not scored evaluations. It does not touch `search-queries.md`, `tracker.csv`, or `job_scraper/seen_jobs.json` - the candidate decides what enters the active search pipeline.

Follow these steps **in order**.

---

## Step 0: Resolve Profile

Resolve the active candidate profile per `.claude/PROFILES.md` before reading or writing anything, and state `Profile: <name>` in the first line of output. `<name>` in every path below is that resolved profile. This command takes no arguments.

---

## Step 1: Load Candidate Context

1. Read `profiles/<name>/skills/01-candidate-profile.md` for the candidate's skills, experience, and languages.
2. Read `profiles/<name>/skills/04-job-evaluation.md` for career goals and deal-breakers (the "Scoring Dimensions" and any career-goals framing at the top of the file).
3. Read `profiles/<name>/skills/search-queries.md`. Extract:
   - The candidate's actual job-board names, city, and country values used in existing `site:` query lines (you will reuse these verbatim in Step 3 - never emit placeholder text like `[YOUR_CITY]` in the output).
   - The role types/industries already covered by existing Priority categories, so exploration targets the gap rather than repeating a category that already exists.

State how many existing query categories were found before proceeding.

---

## Step 2: Web-Research Adjacent Roles and Industries

WebSearch for job titles and industries that commonly hire people with this candidate's specific skill combination - grounded in actual market terminology, not invented from the profile text. Run enough searches to cover both angles:

- **Adjacent titles**: alternate role names for work the candidate is already qualified for (e.g. a backend engineer with strong client-facing experience might also fit "Solutions Engineer" or "Technical Program Manager").
- **Adjacent industries/sectors**: domains outside the candidate's current search where the same skillset transfers (e.g. fintech, healthtech, climate tech), grounded in real postings or hiring trends found via search.

Use queries that include the current year for freshness, e.g. `"[core skill] adjacent job titles 2026"`, `"roles for [skill combination] professionals"`, `"[industry] hiring [skill] background 2026"`.

**Never fabricate a suggestion.** Every suggestion in Step 3 must be backed by at least one real example job title or posting actually found during this research. If a plausible category turns up no grounding evidence, drop it rather than presenting it anyway.

---

## Step 3: Build Suggestions

For each grounded suggestion (title or industry), assemble:

- **Name** - the role title or industry/sector name.
- **Why it fits** - one to two sentences on the skills/experience overlap with the candidate's profile (from Step 1).
- **Example(s)** - 1-2 real job titles or postings seen during Step 2's research, so the suggestion is grounded in something concrete.
- **Paste-ready query block**, in `search-queries.md`'s existing category format, using the candidate's **actual** city/country/job-board values from Step 1 (never placeholder text):

```
### [Suggested Role/Industry Name]

site:[actual job board from search-queries.md] "[Suggested Title]" [actual city]
site:linkedin.com/jobs "[Suggested Title]" [actual country]
```

If a suggestion's title or industry materially overlaps an existing `search-queries.md` category (e.g. it's a variant of a role already covered), still include it if the research surfaced a genuinely different angle (different industry using the same title, for instance), but note the overlap explicitly in "Why it fits" so the candidate does not duplicate work.

No 5-dimension scoring (that framework in `04-job-evaluation.md` is for real postings, not hypothetical categories) and no eligibility/language gating (those apply once an actual posting exists) - keep this step to rationale + grounding + paste-ready query.

---

## Step 4: Write and Save Report

### Compose the report

```markdown
# Explore Roles Report — YYYY-MM-DD

**Profile:** <name>

Existing search-queries.md categories: N found (not repeated below unless a suggestion adds a genuinely new angle).

---

## Suggestions

### <Suggested Role/Industry Name>

**Why it fits:** ...

**Examples seen:** <title/posting 1>, <title/posting 2>

**Paste into search-queries.md:**

\`\`\`
### <Suggested Role/Industry Name>

site:<actual job board> "<Suggested Title>" <actual city>
site:linkedin.com/jobs "<Suggested Title>" <actual country>
\`\`\`

---

(repeat per suggestion)
```

### Save the report

Save to `profiles/<name>/explore_roles/report_<YYYY-MM-DD>.md` using the Write tool. Create the `profiles/<name>/explore_roles/` directory if it does not already exist (same as `/upskill` creates `profiles/<name>/upskill/` on first run).

### Confirm to user

After saving, print the list of suggestions with their one-line "Why it fits" rationale to the terminal, followed by:

> "Report saved to `profiles/<name>/explore_roles/report_<YYYY-MM-DD>.md`. Paste any of the blocks above into `profiles/<name>/skills/search-queries.md` under a new Priority category; `/scrape` picks it up next run."

---

## Important Rules

1. **Never fabricate a suggestion.** Every title or industry must be backed by at least one real example found via actual WebSearch results in Step 2. Do not invent job titles, companies, or postings.
2. **Search with the current year.** Include the year in WebSearch queries so results reflect the current market.
3. **Use real profile values in query blocks.** Job board, city, and country in every paste-ready block come from the candidate's own `search-queries.md`, never placeholder text like `[YOUR_CITY]`.
4. **Read-only against every existing profile artifact.** Never write to `search-queries.md`, `tracker.csv`, or `job_scraper/seen_jobs.json`. The only new file this command writes is its own report.
5. **Always save the report.** Do not skip the Write step even if the user seems satisfied with the terminal output.
````

- [ ] **Step 2: Verify the file matches the spec**

Re-read `docs/superpowers/specs/2026-08-08-explore-roles-design.md` and confirm every numbered step and edge case (no web results → skip suggestion, overlap with existing category → include with note, missing directory → create it) is represented in the command file just written. Fix any gap inline before moving on.

- [ ] **Step 3: Commit**

```bash
git add -f .claude/commands/explore-roles.md
git commit -m "feat(commands): add /explore-roles for adjacent role/industry discovery"
```

(`-f` is required because `docs/` and other paths may be gitignored broadly in this repo, but `.claude/commands/` is already tracked for every other command — confirm with `git check-ignore .claude/commands/explore-roles.md` first; if it reports nothing, drop `-f` and use a plain `git add`.)

---

### Task 2: Verify Profile-Path Isolation via the Existing Audit Test

**Files:**
- Test: `tests/test_profile_paths.py` (existing, no modification needed — `test_unregistered_specs_have_no_candidate_paths` automatically scans every `.md` under `.claude/` not already in `CONVERTED_FILES`, so the new file is covered without editing this file)

**Interfaces:**
- Consumes: `.claude/commands/explore-roles.md` from Task 1.
- Produces: nothing new — this task is verification-only.

- [ ] **Step 1: Run the full path-audit suite**

Run: `python -m pytest tests/test_profile_paths.py -v`

Expected: All tests PASS, including `test_unregistered_specs_have_no_candidate_paths`, which will fail if `explore-roles.md` contains a bare root-relative path (e.g. `reports/`, `job_scraper/`, `upskill/report`) instead of the `profiles/<name>/explore_roles/...` form used throughout Task 1's file.

- [ ] **Step 2: If it fails, fix the offending line and re-run**

The test output prints `file:line: <offending text>` for each hit. Open `.claude/commands/explore-roles.md` at that line, replace the bare path with the `profiles/<name>/...` form, save, and re-run Step 1 until the suite passes.

- [ ] **Step 3: Manual dry run against a real profile**

Using the Claude Code session (not pytest), invoke `/explore-roles` against whichever profile has real candidate data populated (check `.active-profile` or run `/profile status` first). Confirm:
- First line of output states `Profile: <name>`.
- The report is written to `profiles/<name>/explore_roles/report_<today's date>.md` (read the file back with the Read tool to confirm it exists and is non-empty).
- Every suggestion in the report has a paste-ready query block using the profile's actual city/country/job-board values, not placeholder text.
- `profiles/<name>/skills/search-queries.md`, `profiles/<name>/tracker.csv`, and `profiles/<name>/job_scraper/seen_jobs.json` are byte-identical before and after the run (`git status --porcelain` inside `profiles/<name>/` — or a checksum diff if that directory is gitignored — shows only the new report file as an addition).

- [ ] **Step 4: Commit if Step 2 required a fix**

If Task 1's file needed no changes, there is nothing to commit here — Task 1's commit already covers the final content. If Step 2 above required an edit, commit it:

```bash
git add -f .claude/commands/explore-roles.md
git commit -m "fix(commands): use profile-scoped path in explore-roles report location"
```
