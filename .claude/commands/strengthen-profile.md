# /strengthen-profile - LinkedIn + CV Completeness/Quality Advisor

You are auditing the candidate's LinkedIn profile and master CV for structural completeness and presentation quality — independent of any specific job posting or market trend. `/upskill` already compares the profile against market demand; this command never looks at postings and never suggests what skill to learn. `/expand` and `/setup` already ingest the LinkedIn export into profile files; this command reads the same export for its own completeness checks but does not re-run or duplicate that ingestion.

Follow these steps **in order**.

---

## Step 1: Read Sources

**Profile:** resolve the active candidate profile per `.claude/PROFILES.md` before reading or
writing anything, and state `Profile: <name>` in the first line of output. `<name>` in the paths
below is that resolved profile.

Read:
- `profiles/<name>/documents/linkedin/` export (About/summary text, headline as displayed, skills list, recommendations received, work experience with dates)
- `profiles/<name>/skills/01-candidate-profile.md`
- `profiles/<name>/skills/02-behavioral-profile.md`
- `profiles/<name>/PROFILE.md`
- `profiles/<name>/cv/main.tex`

**If no LinkedIn export exists** in `profiles/<name>/documents/linkedin/`: tell the candidate there's nothing to audit for LinkedIn and skip straight to Step 3 (CV checklist only) — do not fabricate a LinkedIn checklist from absent data.

---

## Step 2: LinkedIn Completeness Checklist

Evaluate each item as PASS or FLAG:

| Item | Check |
|---|---|
| Headline | Present at all (FLAG if absent)? If present: just a job title (FLAG) or does it carry a value proposition (PASS)? |
| About section | Present (FLAG if absent)? If present: reasonable length (FLAG if a single line) and opens with something other than "I am a..." (FLAG if it does)? |
| Skills list | Count of listed skills — fewer than 5 is FLAG |
| Recommendations | Count received — 0 is FLAG |
| Work history | Any gap between consecutive roles' end/start dates with no explanation visible in the export — FLAG |
| Photo | Not derivable from a text export — ask directly in Step 4 |
| Custom URL | Not derivable from a text export — ask directly in Step 4 |

---

## Step 3: CV Completeness Checklist

Compare `cv/main.tex` against `01-candidate-profile.md`:

| Item | Check |
|---|---|
| Experience coverage | Every role in `01-candidate-profile.md`'s Professional Experience section has a corresponding entry in `cv/main.tex` — FLAG any missing |
| Bullet specificity | Any bullet in `cv/main.tex` that reads as vague (no number, no concrete outcome) where `01-candidate-profile.md`'s equivalent content has a stronger version available — FLAG, and note the stronger version |
| Section population | Any section with content in `01-candidate-profile.md` (Publications, Awards, Independent Projects) that's empty or missing in `cv/main.tex` — FLAG |

---

## Present the Checklist

One unified report: LinkedIn items first (skip this block entirely if Step 1 found no export), then CV items — each PASS/FLAG with a one-line reason for every FLAG. No suggestions yet; this is diagnostic only.

---

## Step 4: Targeted Q&A

Ask only about FLAGs that need candidate-only information: photo set?, custom URL set?, and the reason behind any flagged work-history gap. Skip straight to Step 5 for FLAGs where the fix is self-evident from data already in hand (e.g. a missing CV bullet the profile already documents in full — no need to ask about that one).

**If a Q&A answer surfaces a new fact** (a work-history-gap explanation that reveals a project, freelance period, or role not yet in the profile): write it to `01-candidate-profile.md` in the same turn — never leave it living only in conversation, same standing rule `/apply` follows for facts learned mid-conversation.

---

## Step 5: Write Suggestions

**LinkedIn** — write to `profiles/<name>/documents/linkedin_suggestions.txt` (overwrite any existing content — this file is advisory output for the current run, not an archive):
- 2–3 headline options, each grounded in `01-candidate-profile.md`'s strongest skills/experience — no fabricated claims
- An About-section rewrite or hook-strengthening suggestion, grounded the same way
- Skills to add to the LinkedIn skills list, drawn from `01-candidate-profile.md`'s Technical Skills section, filtered to ones not already on the candidate's LinkedIn skills list

**CV** — for each FLAG from Step 3, propose the specific edit (the exact bullet or section content to add/strengthen, grounded in `01-candidate-profile.md`), shown as a diff against the current `cv/main.tex` content. Ask the candidate to confirm each one. Apply only confirmed edits, using the Edit tool with targeted changes — never rewrite the whole file.

**If a flagged gap has no grounded fix available** (e.g. zero recommendations, with nothing in the profile files that could ground a suggested recommendation request): report it as a gap the candidate needs to address themselves, not papered over with invented content.

---

## Step 6: Summary

Confirm what was written: the `linkedin_suggestions.txt` path, and which CV edits (if any) were applied. Remind the candidate that LinkedIn changes are theirs to paste in — this command never touches the live LinkedIn profile.

---

## Important Rules

1. **Every suggested word is grounded.** Headline options, About rewrite, skill additions, CV bullet strengthening — all must trace to `01-candidate-profile.md`, `PROFILE.md`, or the master CV. A gap with no grounded fix is reported honestly, never papered over.
2. **CV edits are targeted, never a full rewrite**, and only applied on explicit confirmation per edit.
3. **This command never touches the live LinkedIn profile** — only writes a suggestions file the candidate pastes in themselves.
4. **Q&A stays narrow** — only photo/custom URL/work-gap-context, the three things a text export genuinely can't answer. Every other FLAG's fix comes from data already in hand.
5. **New facts surfaced in Q&A are written to `01-candidate-profile.md` immediately**, not left only in conversation.
