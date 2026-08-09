# Fit-Based Ranking Q&A Enhancement — Design Spec

**Date:** 2026-08-09
**Status:** Approved, pending implementation plan

## Problem

`/rank` already scores every job against the candidate profile and sorts by
overall fit (`.claude/commands/rank.md` Steps 2–3), and `/apply` does the same
per-job with deeper research. Both are already correct for feature #2
("scrape and sort by fit against my profile").

The actual gap: scoring quality depends on profile completeness. Two profile
files back all scoring —
`.claude/skills/job-application-assistant/01-candidate-profile.md` (facts:
skills, experience, languages) and
`.claude/skills/job-application-assistant/04-job-evaluation.md` (scoring
inputs: strong/moderate/weak skill match areas, career goals,
energizing/draining tasks, life-situation context). When `/setup` was run
quickly, or the market shifts to ask about skills the candidate never
recorded, these files can be incomplete — literal `[YOUR_...]` placeholders
left unfilled, or a skill/domain that shows up repeatedly in postings but
appears nowhere in the profile at all. Scoring proceeds anyway, silently
treating missing signal as a low score, without ever asking the candidate to
fill the gap.

This spec adds a shared "thin-spot" detector, used by both `/rank` (batch)
and `/apply` (single job), that finds these gaps, asks the candidate targeted
questions, and writes the answers back into the profile before scoring runs.

## Goals

- Detect two categories of profile thinness relevant to the job(s) being
  scored:
  1. Unfilled `[YOUR_...]` placeholders in `04-job-evaluation.md` dimensions
     needed to score this batch/job.
  2. Skills or domains that appear repeatedly in posting text but are absent
     from both `01-candidate-profile.md` Technical Skills and
     `04-job-evaluation.md`'s strong/moderate/weak match lists.
- Ask the candidate about detected gaps before scoring, so scores reflect an
  accurate picture of their background rather than a stale or incomplete
  profile.
- Persist answers into the profile files so future runs benefit without
  re-asking.
- Track declined/unknown answers so the same gap is never re-asked, while
  still scoring it honestly as a real gap.
- Self-heal: if the candidate later adds a skill through `/expand` or
  `/setup`, the gap stops being detected and any stale "declined" record for
  it is removed automatically.

## Non-Goals

- Not a replacement for `/upskill`, which produces a market-wide learning
  plan from tracked postings. This feature only unblocks *scoring
  confidence* on the current batch/job; it does not generate study plans or
  search for learning resources.
- Not a change to `/scrape`'s own high/medium/low bucketing — that stays as
  a lightweight triage signal; `/rank` remains the authoritative fit-sort.
- Not a change to scoring weights, bands, or dimension definitions in
  `04-job-evaluation.md`.
- Does not touch jobs already in the tracker or already `ranked` (unless the
  user reruns with `--all`, which already re-scores under existing `/rank`
  rules).

## Detection Logic

A "thin spot" is one of:

1. **Placeholder gap.** A `[YOUR_...]` bracketed placeholder still present in
   a `04-job-evaluation.md` dimension section that the current batch/job
   actually needs to score (e.g. `[YOUR_CAREER_GOAL_1]` is only relevant if
   Career Alignment is being scored, which it always is — all five
   dimensions score every job, so any remaining placeholder in a scored
   dimension counts).
2. **Silent-skill gap.** A skill or domain term that:
   - appears in the posting text of at least one job being processed, AND
   - does not appear (case-insensitive substring match is sufficient) in
     `01-candidate-profile.md` Technical Skills section, AND
   - does not appear in any of `04-job-evaluation.md`'s strong/moderate/weak
     match-area lists.

   For `/rank` (batch), only surface a silent-skill gap if it recurs across
   the batch (appears in more than one candidate posting) — a single
   one-off mention is noise, not a pattern worth interrupting the user for.
   For `/apply` (single job), any silent-skill gap in that one posting
   qualifies — there's no batch to average against.

3. **Known-gaps exclusion.** Before surfacing anything, check the `## Known
   Gaps` table in `01-candidate-profile.md` (see below). A gap already
   listed there (any status) is never re-surfaced, regardless of category.
   This check is a live re-scan, not a cache: if the gap's subject (e.g.
   "Kubernetes") has since appeared in the Technical Skills or match-area
   lists (because `/expand` or `/setup` added it), the gap is no longer
   silent by definition (category 2's second condition no longer holds), so
   it naturally stops being detected — no explicit "resolved" state is
   needed for silent-skill gaps.

   Placeholder gaps resolve the same way: once the placeholder is replaced
   with real text, it no longer matches the `[YOUR_...]` pattern and stops
   being detected.

## Q&A Flow

### `/rank` — new Step 1.5 (between "Load State" and "Batch-Fetch and Score")

1. After loading candidate jobs and the profile (existing Step 1), scan the
   stored posting text/fit-notes for every candidate job for thin spots,
   using the detection logic above.
2. Filter out anything listed in `## Known Gaps`.
3. Rank remaining thin spots by `(number of jobs in this batch affected) ×
   (dimension weight from 04-job-evaluation.md, or 1 for silent-skill gaps
   which aren't tied to a single weighted dimension)`. Cap at 5.
4. If the list is non-empty, ask all of them in a single `AskUserQuestion`
   round (up to 5 questions). If empty, skip straight to Step 2 — no
   interruption when the profile is already sufficient.
5. Apply each answer to the profile per the write rules below.
6. Proceed to the existing Step 2 (Batch-Fetch and Score) using the updated
   profile content.

If more than 5 thin spots exist, the remaining ones are simply not asked
this run (they'll surface again on a future `/rank` run with a fresh batch,
still subject to the same cap and the recurrence rule for silent-skill
gaps).

### `/apply` — new sub-step inside existing Step 1, before scoring

1. After fetching the single posting, scan it alone for thin spots against
   the current profile.
2. Filter out `## Known Gaps` entries.
3. If any remain, ask all of them in one `AskUserQuestion` round (no cap
   needed — a single posting naturally produces few).
4. Apply answers per the write rules below.
5. Proceed with the existing Step 1 evaluation using the updated profile.

## Profile Write Rules

- **Placeholder answers** → replace the literal `[YOUR_...]` placeholder
  text in `04-job-evaluation.md` with the candidate's answer, verbatim, in
  the same location/format the template already uses (e.g. a career-goal
  bullet stays a bullet).
- **Silent-skill answers** → the question always distinguishes "I have this
  skill" from "genuine gap, I don't." For "I have this skill, here's my
  level": add to `01-candidate-profile.md` Technical Skills (with whatever
  proficiency framing the candidate gives) and add the skill to the
  matching strong/moderate/weak list in `04-job-evaluation.md` based on how
  they characterized their proficiency. For "genuine gap" or "I don't know":
  do not add to Technical Skills or match lists — add a row to `## Known
  Gaps` instead (see below), so scoring counts it honestly as a weakness.
- Writes happen immediately after the Q&A round, before scoring proceeds,
  so the same run's scoring reflects the update.

## Known Gaps Table

New section appended to `01-candidate-profile.md`, created on first use if
absent:

```markdown
## Known Gaps
<!-- Populated by /rank and /apply when a profile thin-spot is asked about.
Entries here are never re-surfaced as questions. Removed automatically by
/expand or /setup when the same skill is later added to Technical Skills. -->

| Gap | Asked | Status |
|-----|-------|--------|
| Kubernetes | 2026-08-09 | declined |
```

- `Gap`: the skill/domain term or placeholder identifier.
- `Asked`: date first surfaced (YYYY-MM-DD).
- `Status`: `declined` (candidate confirmed it's a genuine gap) or `unknown`
  (candidate didn't have an answer). Both are treated identically by the
  exclusion check — the distinction is informational only, for the
  candidate reading their own profile later.

`/expand` and `/setup`: when either command adds a skill to Technical
Skills, it must also delete any `## Known Gaps` row whose `Gap` matches that
skill (case-insensitive), so the table doesn't accumulate stale rows once
the candidate has genuinely upskilled.

## Error Handling & Edge Cases

- Profile has no `04-job-evaluation.md` framework file yet (setup never
  run): `/rank` and `/apply` already require setup to have run for scoring
  to work at all (existing behavior) — this feature adds no new
  precondition.
- Posting text unavailable (expired/dead link): that job is already marked
  `expired` by existing logic before thin-spot scanning would matter; thin-
  spot detection only runs against jobs that will actually be scored.
- User answers a placeholder question with something that doesn't fit the
  expected shape (e.g. answers a career-goal question with a skill): store
  verbatim as given — no validation beyond what `/setup` already does for
  the same fields.
- Re-running `/rank --all`: thin-spot scan re-runs against the full
  re-score batch same as any other `/rank` invocation; `## Known Gaps`
  exclusions still apply.

## Testing Notes

- Unit-level (manual verification, since these are markdown-driven prompt
  workflows, not executable code): construct a test profile with a known
  placeholder left unfilled and a posting mentioning a skill absent from the
  profile; run `/rank` and confirm exactly the expected questions are
  asked, in the expected priority order when more than 5 candidates exist.
- Confirm a `Known Gaps` entry suppresses re-asking on a second `/rank` run
  over a fresh batch that still mentions the same skill.
- Confirm adding the declined skill via `/expand` removes the `Known Gaps`
  row and the skill no longer triggers detection.
- Confirm `/apply` on a single job surfaces silent-skill gaps without the
  "recurs across batch" requirement that `/rank` applies.

## Files Touched

- `.claude/commands/rank.md` — new Step 1.5.
- `.claude/commands/apply.md` — new sub-step in Step 1.
- `.claude/skills/job-application-assistant/01-candidate-profile.md` — add
  `## Known Gaps` section to the template.
- `.claude/commands/expand.md`, `.claude/commands/setup.md` — add Known Gaps
  pruning when a skill is added.
