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

1. **Placeholder gap.** A `[YOUR_...]` bracketed placeholder still present in
   a `04-job-evaluation.md` dimension section. All five scoring dimensions
   (Technical Skills, Experience, Behavioral/Culture, Location, Career
   Alignment) score every job, so any remaining placeholder anywhere in
   those sections counts — there is no dimension you can skip checking.
2. **Silent-skill gap.** A skill or domain term that appears in a posting's
   text AND does not appear (case-insensitive substring match) in either:
   - `01-candidate-profile.md`'s Technical Skills section, or
   - any of `04-job-evaluation.md`'s strong/moderate/weak match-area lists.

   For a batch (multiple postings, as in `/rank`): only surface a
   silent-skill gap that appears in **more than one** posting in the batch.
   A single one-off mention is noise.
   For a single posting (as in `/apply`): any silent-skill gap in that one
   posting qualifies — there is no batch to require recurrence against.

## Known Gaps Table

Before surfacing any thin spot, check the `## Known Gaps` table in
`01-candidate-profile.md` (added by this feature — see
`01-candidate-profile.md`'s template). A gap already listed there, in any
`Status`, is never re-surfaced as a question, regardless of category.

This check re-scans live, not from a cache: if the gap's subject has since
been added to Technical Skills or a match-area list (via `/expand` or
`/setup`), the silent-skill condition above no longer holds, so it stops
being detected on its own — no separate "resolved" state is tracked.
Placeholder gaps resolve the same way: once the placeholder text is
replaced, it no longer matches `[YOUR_...]` and stops being detected.

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

- `Gap`: the skill/domain term (silent-skill gap) or a short identifier for
  the placeholder (e.g. `Career goal`, placeholder gap).
- `Asked`: date first surfaced, `YYYY-MM-DD`.
- `Status`: `declined` (candidate confirmed it's a genuine gap) or `unknown`
  (candidate had no answer). Both are excluded identically by the check
  above — the distinction is informational for the candidate only.

## Q&A Construction

1. Scan for thin spots per the Detection Rules, against the set of jobs in
   scope for this run (the full ranking batch for `/rank`, the single
   fetched posting for `/apply`).
2. Filter out anything already in the Known Gaps table.
3. For `/rank` only: if more than 5 thin spots remain, rank by
   `(number of jobs in this batch mentioning the gap) x (dimension weight
   from 04-job-evaluation.md's Weighting section, or 1 for silent-skill
   gaps not tied to a single weighted dimension)`, descending, and keep the
   top 5. Drop the rest silently for this run — they remain eligible to
   surface on a future run.
4. If the remaining list is empty, skip straight to scoring — do not
   interrupt the user.
5. If non-empty, ask all remaining thin spots in a single `AskUserQuestion`
   call (one round, not one question at a time) before scoring proceeds.
   Phrase each question so the user can answer either "I have this, here's
   my level" or "genuine gap" / "don't know" — a silent-skill question
   needs both branches available; a placeholder question just needs the
   missing fact.

## Profile Write Rules

Apply immediately after the Q&A round, before scoring proceeds:

- **Placeholder answer** → replace the literal `[YOUR_...]` placeholder text
  in `04-job-evaluation.md` with the candidate's answer, verbatim, keeping
  the surrounding format (a bullet placeholder stays a bullet, etc).
- **Silent-skill answer, "I have this skill"** → append to
  `01-candidate-profile.md`'s Technical Skills section (with whatever
  proficiency the candidate states) AND append the skill to the matching
  strong/moderate/weak list in `04-job-evaluation.md`, chosen by how the
  candidate characterized their proficiency.
- **Silent-skill answer, "genuine gap" or "don't know"** → do not add
  anything to Technical Skills or the match lists. Instead add a row to the
  Known Gaps table (Status `declined` or `unknown` respectively).
- **Placeholder answer, "don't know" / declined** → add a row to the Known
  Gaps table with the placeholder's identifier as `Gap` (e.g. `Career goal`)
  and Status `unknown`, and leave the placeholder text in place (it will be
  asked about again only if a future scan still needs that dimension and
  the row is later removed — in practice this row makes it permanently
  excluded like any other Known Gaps entry).

## Pruning Rule

Any command that adds a skill to `01-candidate-profile.md`'s Technical
Skills section (currently: `/expand`, `/setup`) must, in the same write,
delete any Known Gaps row whose `Gap` matches that skill (case-insensitive).
This keeps the table from accumulating stale rows once the candidate has
genuinely upskilled.
