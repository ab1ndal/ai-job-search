---
framework_version: 1.0.0
---

# Thin-Spot Detection

<!-- Shared by /rank and /apply. Detects when the candidate profile is too
thin to score a job confidently, and defines how to ask about it, write the
answer back, and avoid re-asking. See
docs/superpowers/specs/2026-08-09-fit-based-ranking-qa-design.md for the
full design rationale. -->

## Detection Rules

A **thin spot** is one of:

1. **Placeholder gap.** Any bracketed `[ALL_CAPS_WITH_UNDERSCORES]`
   placeholder still present in a `04-job-evaluation.md` dimension section
   (e.g. `[YOUR_CAREER_GOAL_1]` or `[SKILLS_YOU_LACK]` — all bracketed
   placeholders count, not only ones prefixed `YOUR_`). All five scoring
   dimensions (Technical Skills, Experience, Behavioral/Culture, Location,
   Career Alignment) score every job, so any remaining placeholder anywhere
   in those sections counts — there is no dimension you can skip checking.
   Detected by both `/rank` and `/apply`.
2. **Silent-skill gap.** A skill or domain term that appears in a posting's
   text AND does not appear (case-insensitive substring match) in either:
   - `01-candidate-profile.md`'s Technical Skills section, or
   - any of `04-job-evaluation.md`'s strong/moderate/weak match-area lists.

   **This category is `/apply`-only.** Detecting it requires posting text
   already in context, and `/apply` is the only workflow that has fetched a
   posting before its thin-spot scan runs (Step 0, before Step 1's scan).
   `/rank`'s Step 1.5 runs before any posting text is fetched — `/scrape`'s
   `seen_jobs.json` stores only title/company/url/fit-bucket, never posting
   body — so `/rank` cannot evaluate this category at all and only ever
   detects placeholder gaps.

## Known Gaps Table

Before surfacing any thin spot, check the `## Known Gaps` table in
`01-candidate-profile.md` (added by this feature — see
`01-candidate-profile.md`'s template). A gap already listed there, in any
`Status`, is never re-surfaced as a question, regardless of category. This
match is **case-insensitive**.

This check re-scans live, not from a cache: if the gap's subject has since
been added to Technical Skills or a match-area list (via `/expand` or
`/setup`), the silent-skill condition above no longer holds, so it stops
being detected on its own — no separate "resolved" state is tracked.
Placeholder gaps resolve the same way: once the placeholder text is
replaced, it no longer matches the `[ALL_CAPS_WITH_UNDERSCORES]` pattern and
stops being detected.

The `Gap` value recorded for a placeholder gap must be the **literal
placeholder token verbatim** (e.g. `[YOUR_CAREER_GOAL_1]`), never a
paraphrase — two different runs paraphrasing the same placeholder
differently (e.g. "Career goal" vs. "Career goals") would defeat this
exclusion check on the next run, since the check matches on this text.

If the table doesn't exist yet in a given profile's `01-candidate-profile.md`
(pre-dates this feature), create it on first write using the format below.

Table format:

```markdown
## Known Gaps
<!-- Populated by /rank and /apply when a profile thin-spot is asked about.
Entries here are never re-surfaced as questions. Removed automatically by
/expand or /setup when the same skill is later added to Technical Skills. -->

| Gap | Asked | Status |
|-----|-------|--------|
| Kubernetes | 2026-08-09 | declined |
```

- `Gap`: the skill/domain term (silent-skill gap), or the literal
  placeholder token verbatim, e.g. `[YOUR_CAREER_GOAL_1]` (placeholder gap —
  never a paraphrase, since the exclusion check matches on this text).
- `Asked`: date first surfaced, `YYYY-MM-DD`.
- `Status`: `declined` or `unknown`. `declined` applies **only to
  silent-skill gaps** — the candidate confirmed they lack the skill.
  `unknown` applies to placeholder gaps always (a fact the candidate simply
  doesn't have doesn't fit "declined", which describes confirming the
  absence of a skill), and to silent-skill gaps when the candidate answered
  "Not sure" instead of confirming a genuine gap. Both statuses are excluded
  identically by the check above (case-insensitive) — the distinction is
  informational only, for the candidate reading their own profile later.

## Q&A Construction

`/rank` and `/apply` run two different flows against these shared rules —
`/rank` never has posting text, so it only ever asks about placeholder gaps;
`/apply` always has a single fetched posting, so it asks about both
categories.

**`/rank`:**

1. Scan `04-job-evaluation.md` for placeholder gaps only (per Detection
   Rules §1 — no posting text is available at this point).
2. Filter out anything already in the Known Gaps table (case-insensitive).
3. If more than 5 remain, rank by dimension weight from
   `04-job-evaluation.md`'s Weighting section (unweighted dimensions, i.e.
   Location, use weight 1), descending, and keep the top 5. There is no
   job-count factor — placeholder-only detection has no per-posting
   recurrence to count. Drop the rest silently for this run — they remain
   eligible to surface on a future run.
4. If the remaining list is empty, skip straight to scoring — do not
   interrupt the user.
5. If non-empty, ask all remaining thin spots in a single `AskUserQuestion`
   call (one round, not one question at a time) before scoring proceeds.

**`/apply`:**

1. Scan the single fetched posting for both placeholder gaps and
   silent-skill gaps (per Detection Rules §1 and §2).
2. Filter out anything already in the Known Gaps table (case-insensitive).
3. No cap — a single posting naturally produces few thin spots.
4. If the remaining list is empty, skip straight to scoring — do not
   interrupt the user.
5. If non-empty, ask all remaining thin spots in a single `AskUserQuestion`
   call (one round, not one question at a time) before scoring proceeds.
   The silent-skill `AskUserQuestion` must offer exactly these four options:
   **Strong**, **Working**, **None — genuine gap**, **Not sure**. A
   placeholder question just asks for the missing fact.

## Profile Write Rules

Apply immediately after the Q&A round, before scoring proceeds. All file
paths below are `profiles/<name>/skills/01-candidate-profile.md` and
`profiles/<name>/skills/04-job-evaluation.md` — the resolved candidate's
copies, never the template copies in
`.claude/skills/job-application-assistant/`, which are read-only references
this feature must never write to.

- **Placeholder answer** → replace the literal placeholder token in
  `profiles/<name>/skills/04-job-evaluation.md` with the candidate's answer,
  verbatim, keeping the surrounding format (a bullet placeholder stays a
  bullet, etc). If the candidate has no answer ("I don't know" / declines to
  say), leave the placeholder in place and add a `## Known Gaps` row in
  `profiles/<name>/skills/01-candidate-profile.md` using the literal
  placeholder token as `Gap` and Status `unknown` — never `declined`.
- **Silent-skill answer, "Strong" or "Working"** → append to
  `profiles/<name>/skills/01-candidate-profile.md`'s Technical Skills
  section (proficiency per the option chosen) AND append the skill to the
  matching strong/moderate match-area list in
  `profiles/<name>/skills/04-job-evaluation.md`.
- **Silent-skill answer, "None — genuine gap"** → add a `## Known Gaps` row
  in `profiles/<name>/skills/01-candidate-profile.md` with Status
  `declined`. Do not touch Technical Skills or the match-area lists, so
  scoring counts the gap honestly as a weakness.
- **Silent-skill answer, "Not sure"** → add a `## Known Gaps` row in
  `profiles/<name>/skills/01-candidate-profile.md` with Status `unknown`. Do
  not touch Technical Skills or the match-area lists.

## Pruning Rule

Any command that adds a skill to `01-candidate-profile.md`'s Technical
Skills section (currently: `/expand`, `/setup`) must, in the same write,
delete any Known Gaps row whose `Gap` matches that skill (case-insensitive).
This keeps the table from accumulating stale rows once the candidate has
genuinely upskilled.
