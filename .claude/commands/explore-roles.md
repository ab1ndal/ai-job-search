# /explore-roles - Surface Adjacent Roles and Industries Beyond Your Search Queries

`/scrape` only finds jobs matching the fixed query categories already written in `search-queries.md`. `/explore-roles` looks outward from the candidate's actual skills and experience to surface role titles and industries the candidate never thought to search for - market-grounded suggestions, not a guess from the profile text alone.

`/explore-roles` produces **lightweight suggestions**, not scored evaluations. It does not touch `search-queries.md`, `tracker.csv`, or `profiles/<name>/job_scraper/seen_jobs.json` - the candidate decides what enters the active search pipeline.

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
4. **Read-only against every existing profile artifact.** Never write to `search-queries.md`, `tracker.csv`, or `profiles/<name>/job_scraper/seen_jobs.json`. The only new file this command writes is its own report.
5. **Always save the report.** Do not skip the Write step even if the user seems satisfied with the terminal output.
