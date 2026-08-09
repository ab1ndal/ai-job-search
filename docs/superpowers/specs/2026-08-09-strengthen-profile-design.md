# /strengthen-profile — LinkedIn + CV Completeness/Quality Advisor — Design Spec

**Date:** 2026-08-09
**Status:** Approved, pending implementation plan

## Problem

The repo has commands that ingest data (`/expand`, `/setup` pull from documents
into profile files) and commands that consume it (`/apply`, `/rank` score
jobs against it; `/upskill` compares it to market demand). Nothing looks at
the candidate's actual public-facing materials — their LinkedIn profile and
master CV — and asks whether those materials themselves are complete and
well-presented, independent of any specific job or market trend. A LinkedIn
profile with no About section, a headline that's just a job title, three
skills listed, and zero recommendations is weak regardless of what the
market wants; a master CV missing bullets for a role the candidate profile
already documents is a gap regardless of any posting.

## Goals

- A new command, `/strengthen-profile`, that audits LinkedIn and the master
  CV for structural completeness and presentation quality, using data
  already in the repo (the LinkedIn export, `01-candidate-profile.md`,
  `02-behavioral-profile.md`, `PROFILE.md`, `cv/main.tex`) plus a short,
  targeted Q&A for anything only the candidate can answer (photo set?,
  custom URL?, context behind a work-history gap?).
- Present one unified pass/flag checklist covering both LinkedIn and the CV.
- Write concrete, grounded suggestions the candidate can act on: LinkedIn
  copy (headline options, About rewrite, skill additions) to a `.txt` file
  they paste in themselves, and CV fixes as a proposed diff against
  `cv/main.tex`, applied only on confirmation.
- Any new fact the Q&A surfaces gets written back to
  `profiles/<name>/skills/01-candidate-profile.md` immediately — the same
  standing rule `/apply` already follows for facts learned in conversation.

## Non-Goals

- Not a market-fit gap analysis. `/upskill` already compares the profile
  against tracked postings and produces a learning plan — this command
  never looks at postings and never suggests what skill to learn.
- Not a data-ingestion command. `/expand` and `/setup` already parse the
  LinkedIn export into profile files — this command reads the same export
  for its own completeness checks but does not re-run that ingestion or
  duplicate its extraction logic.
- Not browser automation. This command never opens or edits the candidate's
  live LinkedIn profile — it writes suggested text to a file, and the
  candidate pastes it in themselves. (A future `/fill-form`-style assistant
  could automate this; out of scope here.)
- Does not touch any tailored per-job CV (`cv/main_<company>_<role>.tex`) —
  only the master CV (`cv/main.tex`), which every tailored CV derives from.
- No persistent "declined/known gap" tracking the way #2's thin-spot
  detection has. This command's gaps are about presentation completeness,
  re-checked fresh each run — there's no scoring accuracy at stake that
  would be corrupted by re-asking, and re-running after the candidate has
  updated LinkedIn/CV themselves is the expected, cheap use case.

## Command Flow

### Step 1: Read Sources

Resolve the active profile per `.claude/PROFILES.md`, state `Profile:
<name>`. Read:
- `profiles/<name>/documents/linkedin/` export (same file `/expand` and
  `/setup` already parse — do not re-derive its parsing rules, just read
  the same source content this command needs: About/summary text, headline
  as displayed, skills list, recommendations received, work experience with
  dates)
- `profiles/<name>/skills/01-candidate-profile.md`
- `profiles/<name>/skills/02-behavioral-profile.md`
- `profiles/<name>/PROFILE.md`
- `profiles/<name>/cv/main.tex`

If no LinkedIn export exists in `profiles/<name>/documents/linkedin/`, skip
the LinkedIn checklist entirely and tell the candidate why (no export to
audit), running the CV checklist alone.

### Step 2: LinkedIn Completeness Checklist

For each item, mark PASS or FLAG:

| Item | Check |
|---|---|
| Headline | Present at all? If present, is it just a job title (FLAG) or does it carry a value proposition (PASS)? |
| About section | Present (PASS/FLAG)? If present, length reasonable (not a single line) and opens with something other than "I am a...")? |
| Skills list | Count of listed skills — fewer than 5 is FLAG |
| Recommendations | Count received — 0 is FLAG |
| Work history | Any gap between consecutive roles' end/start dates with no explanation visible in the export — FLAG, to raise in Q&A |
| Photo | Not derivable from a text export — ask the candidate directly |
| Custom URL | Not derivable from a text export — ask the candidate directly |

### Step 3: CV Completeness Checklist

Compare `cv/main.tex` against `01-candidate-profile.md`:

| Item | Check |
|---|---|
| Experience coverage | Every role in `01-candidate-profile.md`'s Professional Experience section has a corresponding entry in `cv/main.tex` — FLAG any missing |
| Bullet specificity | Any bullet in `cv/main.tex` that reads as vague (no number, no concrete outcome) where `01-candidate-profile.md`'s equivalent content has one available — FLAG with the stronger version available |
| Section population | Any section with content in `01-candidate-profile.md` (Publications, Awards, Independent Projects) that's empty or missing in `cv/main.tex` — FLAG |

### Step 4: Present the Checklist

One unified report, LinkedIn items first, then CV items, each as
PASS/FLAG with a one-line reason for every FLAG. No suggestions yet — this
step is purely diagnostic.

### Step 5: Targeted Q&A

Only for FLAGs that need candidate-only information: photo set?, custom URL
set?, and the reason behind any flagged work-history gap. Skip straight to
Step 6 for FLAGs where the fix is self-evident from data already in hand
(e.g. a missing CV bullet the profile already documents in full).

Any new fact surfaced here (a work-history gap explanation that reveals a
project or freelance period not yet in the profile, for instance) is
written to `01-candidate-profile.md` in the same turn — never left only in
conversation.

### Step 6: Write Suggestions

**LinkedIn** — write to `profiles/<name>/documents/linkedin_suggestions.txt`
(created fresh each run, overwriting any prior version — this is advisory
output, not an archive):
- 2–3 headline options, each grounded in `01-candidate-profile.md`'s
  strongest skills/experience, none fabricated
- An About-section rewrite or hook-strengthening suggestion, grounded the
  same way
- Skills to add to the LinkedIn skills list, drawn from
  `01-candidate-profile.md`'s Technical Skills section, filtered to ones
  not already listed

**CV** — for each FLAG from Step 3, propose a specific edit (the exact
bullet or section content to add/strengthen, grounded in
`01-candidate-profile.md`) and show it as a diff against the current
`cv/main.tex` content. Apply only the edits the candidate confirms, using
the Edit tool — never rewrite the whole file, same discipline `/apply` and
`/expand` already follow for targeted profile edits.

### Step 7: Summary

Confirm what was written (`linkedin_suggestions.txt` path, which CV edits
were applied), and remind the candidate that LinkedIn changes are theirs to
paste in — this command never touches the live LinkedIn profile.

## Grounding Rule

Every suggested word — headline options, About rewrite, skill additions,
CV bullet strengthening — must trace to `01-candidate-profile.md`,
`PROFILE.md`, or the master CV. Same Rule 3 (never fabricate) that governs
every other document-producing command in this repo. A flagged gap with no
grounded fix available is reported as a gap the candidate needs to
address themselves (e.g. "you have no recommendations — consider asking a
past manager"), not papered over with invented content.

## Files Touched

- `.claude/commands/strengthen-profile.md` — new command implementing the
  flow above.
- `profiles/<name>/documents/linkedin_suggestions.txt` — new advisory
  output file, written/overwritten per run (not a repo file this plan
  creates — a runtime artifact the command produces).
- `profiles/<name>/cv/main.tex` — edited in place, targeted edits only, on
  candidate confirmation.
- `profiles/<name>/skills/01-candidate-profile.md` — edited in place when
  Q&A surfaces a new fact, same standing rule as `/apply`.

## Testing Notes

Markdown-driven command, no executable code — verified by manual
worked-example trace, same method as the fit-ranking feature:
- Construct a test profile with a LinkedIn export missing an About section
  and fewer than 5 skills listed, and a `cv/main.tex` missing a bullet the
  profile documents. Confirm the checklist flags exactly these three items
  and no others.
- Confirm the Q&A step only asks about photo/custom URL/work-gap context —
  never re-asks something already answerable from the checklist data.
- Confirm a work-history-gap answer that reveals a new fact gets written to
  `01-candidate-profile.md` in the same turn.
- Confirm `linkedin_suggestions.txt` content only contains claims traceable
  to the profile files — no invented skills or achievements.
