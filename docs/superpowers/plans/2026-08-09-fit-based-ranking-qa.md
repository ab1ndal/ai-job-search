# Fit-Based Ranking Q&A Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect when the candidate profile is too thin to score a job (or batch of jobs) confidently, ask the candidate targeted questions before scoring, and persist the answers so future runs don't re-ask.

**Architecture:** This repo has no application code — every "component" is a markdown instruction file consumed by an LLM agent at runtime (`.claude/commands/*.md` are slash-command prompts, `.claude/skills/job-application-assistant/*.md` are reference docs those prompts point agents to). This feature adds one new reference doc (`10-thin-spot-detection.md`) holding the shared detection/write logic, a new `## Known Gaps` template section in the candidate-profile template, and small wiring edits in `/rank`, `/apply`, `/expand`, and `/setup` that point to the new reference doc at the right point in each command's existing step sequence.

**Tech Stack:** Markdown prompt files only. No build, no test runner. "Testing" a task means: draft a concrete worked scenario (an example profile + example postings), manually trace what an agent following the new instructions would do step by step, and confirm the output matches the spec's stated behavior. This is the same verification method the repo's existing commands rely on (there are no `.claude/commands/*.test.*` files anywhere in this repo).

## Global Constraints

- Spec source of truth: `docs/superpowers/specs/2026-08-09-fit-based-ranking-qa-design.md`. Every task below implements one section of it; do not deviate from the detection rules, cap of 5, or write rules defined there without updating the spec first.
- `/rank`'s existing Steps 2-5 (`.claude/commands/rank.md`) and `/apply`'s existing Steps 2-6 (`.claude/commands/apply.md`) are unmodified by this feature — only new steps are inserted before them.
- `/upskill` is out of scope — do not read, write, or reference `.claude/skills/upskill/SKILL.md` in any task.
- All new profile writes go through the same two files the rest of the repo already treats as sources of truth: `profiles/<name>/skills/01-candidate-profile.md` and `profiles/<name>/skills/04-job-evaluation.md`. No new profile files.
- Numbered reference files in `.claude/skills/job-application-assistant/` currently run 01-09; the new file is `10-thin-spot-detection.md`, following that existing convention.

---

### Task 1: Shared thin-spot detection reference doc

**Files:**
- Create: `.claude/skills/job-application-assistant/10-thin-spot-detection.md`

**Interfaces:**
- Consumes: nothing (first task; references existing `01-candidate-profile.md` and `04-job-evaluation.md` structure by section name only, no code interface).
- Produces: a reference doc that Tasks 3 and 4 point to from `/rank` and `/apply`, and Tasks 5 and 6 point to from `/expand` and `/setup` for the pruning rule. Other tasks refer to this file by these exact anchor names: "Detection Rules", "Known Gaps Table", "Q&A Construction", "Profile Write Rules", "Pruning Rule".

- [ ] **Step 1: Draft the file content**

Write `.claude/skills/job-application-assistant/10-thin-spot-detection.md` with this exact content:

```markdown
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
```

- [ ] **Step 2: Trace a worked example against the file**

Manually simulate: profile has no Kubernetes anywhere, and a `/rank` batch
of 4 jobs has "Kubernetes" in the text of 2 of them and "Kubernetes" absent
from the other 2. Confirm, reading the file just written:
- Detection Rules → silent-skill gap fires (Kubernetes appears in 2 > 1
  postings in the batch).
- Known Gaps Table → not listed yet, so not excluded.
- Q&A Construction → gets asked (assuming <5 total thin spots this run).
- If the user answers "genuine gap" → Profile Write Rules says: no Technical
  Skills write, add Known Gaps row with Status `unknown` or `declined`.
- Re-running `/rank` later with the same 2 jobs still in the batch →
  Known Gaps Table check excludes it this time.

Confirm each of these traces matches what the file's prose actually says —
if any step's logic is ambiguous or missing from the draft, fix the file
before proceeding.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/job-application-assistant/10-thin-spot-detection.md
git commit -m "feat(job-application-assistant): add thin-spot detection reference doc"
```

---

### Task 2: Known Gaps template section in candidate profile

**Files:**
- Modify: `.claude/skills/job-application-assistant/01-candidate-profile.md`

**Interfaces:**
- Consumes: the Known Gaps table format defined in Task 1's `10-thin-spot-detection.md`.
- Produces: the `## Known Gaps` section, present in every profile generated from this template from now on, at the exact table shape Task 1 and later tasks read/write.

- [ ] **Step 1: Add the section**

In `.claude/skills/job-application-assistant/01-candidate-profile.md`, insert a new section after `## References` (the current last section, ending at line 73 with "More references available upon request."):

```markdown

## Known Gaps
<!-- Populated by /rank and /apply when a profile thin-spot is asked about.
Entries here are never re-surfaced as questions. Removed automatically by
/expand or /setup when the same skill is later added to Technical Skills.
See .claude/skills/job-application-assistant/10-thin-spot-detection.md -->

| Gap | Asked | Status |
|-----|-------|--------|
```

Leave the table with a header row only and no data rows — this is a
template, populated per-candidate at runtime by `/rank` and `/apply`.

- [ ] **Step 2: Verify placement and formatting**

Read the file back and confirm: the new section sits after `## References`
and before end-of-file, uses the same `##` heading level as every other
top-level section in the file, and the HTML comment style matches the
existing comments in the same file (e.g. the Languages section's comment at
lines 21-24).

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/job-application-assistant/01-candidate-profile.md
git commit -m "feat(job-application-assistant): add Known Gaps template section"
```

---

### Task 3: Wire thin-spot Q&A into /rank

**Files:**
- Modify: `.claude/commands/rank.md:36-38` (between existing "Step 1: Load State" and "Step 2: Batch-Fetch and Score")

**Interfaces:**
- Consumes: `10-thin-spot-detection.md`'s Detection Rules, Known Gaps Table, Q&A Construction, and Profile Write Rules (Task 1).
- Produces: nothing new consumed elsewhere — this is a leaf wiring task.

- [ ] **Step 1: Insert the new step**

In `.claude/commands/rank.md`, after line 37 (`State how many jobs will be ranked before proceeding.`) and before the `---` at line 38 that precedes `## Step 2: Batch-Fetch and Score`, insert:

```markdown

---

## Step 1.5: Thin-Spot Q&A

Read `.claude/skills/job-application-assistant/10-thin-spot-detection.md` once (not per job).

Using its Detection Rules, scan the candidate jobs selected in Step 1 (their
stored posting text / fit-notes in `seen_jobs.json`) for thin spots against
the profile files already read in Step 1. Apply the Known Gaps exclusion,
then the batch cap-of-5 ranking rule from Q&A Construction.

If any thin spots remain, ask them all in a single `AskUserQuestion` round,
then apply the Profile Write Rules to update `01-candidate-profile.md`
and/or `04-job-evaluation.md` accordingly before continuing.

If no thin spots remain after the Known Gaps exclusion, say nothing and
continue straight to Step 2.
```

- [ ] **Step 2: Verify the insertion**

Read `.claude/commands/rank.md` back and confirm: exactly one new `##
Step 1.5` section exists, it sits between Step 1 and Step 2, the existing
Step 2 heading and everything after it is unchanged, and the file still
reads top-to-bottom as "Step 0 → Step 1 → Step 1.5 → Step 2 → Step 3 →
Step 4 → Step 5 → Important Rules".

- [ ] **Step 3: Trace a worked example**

Simulate a `/rank` run against a candidate whose `04-job-evaluation.md`
still has `[YOUR_CAREER_GOAL_1]` unfilled, ranking a batch of 3 jobs.
Confirm: Step 1.5 fires (placeholder gap, always relevant since Career
Alignment scores every job), one question gets asked via `AskUserQuestion`,
the answer overwrites the placeholder text in `04-job-evaluation.md`, and
Step 2 then proceeds using the updated file — matching the spec's stated
`/rank` flow.

- [ ] **Step 4: Commit**

```bash
git add .claude/commands/rank.md
git commit -m "feat(rank): ask about thin profile spots before batch scoring"
```

---

### Task 4: Wire thin-spot Q&A into /apply

**Files:**
- Modify: `.claude/commands/apply.md:37-62` (inside existing "Step 1: DRAFTER - Evaluate Fit")

**Interfaces:**
- Consumes: `10-thin-spot-detection.md`'s Detection Rules, Known Gaps Table, Q&A Construction, and Profile Write Rules (Task 1).
- Produces: nothing new consumed elsewhere — leaf wiring task.

- [ ] **Step 1: Insert the sub-step**

In `.claude/commands/apply.md`, at the start of `## Step 1: DRAFTER -
Evaluate Fit` (line 37), immediately after the existing "Read the evaluation
framework" bullet list (lines 39-41) and before the "Using the framework
from `04-job-evaluation.md`, evaluate..." paragraph (line 43), insert:

```markdown

Read `.claude/skills/job-application-assistant/10-thin-spot-detection.md`.
Using its Detection Rules, scan this posting's text for thin spots against
the profile files just read. Apply the Known Gaps exclusion (no batch cap
needed — this is a single posting).

If any thin spots remain, ask them all in a single `AskUserQuestion` round,
then apply the Profile Write Rules to update `01-candidate-profile.md`
and/or `04-job-evaluation.md` before evaluating. If none remain, continue
straight to the evaluation below.

```

- [ ] **Step 2: Verify the insertion**

Read `.claude/commands/apply.md` back and confirm the new paragraph sits
between the "Read the evaluation framework" bullets and the "Using the
framework..." evaluation paragraph, inside Step 1, and that the rest of
Step 1 (salary lookup, presentation format, the "Should I proceed" prompt)
is unchanged.

- [ ] **Step 3: Trace a worked example**

Simulate `/apply` on a single posting that mentions "Terraform" once, where
the candidate's profile has no Terraform anywhere. Confirm: Detection Rules
fire for `/apply` (no recurrence requirement — one mention in one posting is
enough), Known Gaps doesn't exclude it (first time seen), one question gets
asked, and depending on the answer either Technical Skills gets the new
entry or a Known Gaps row gets added — matching the spec's `/apply` flow
(no cap, "any silent-skill gap... qualifies").

- [ ] **Step 4: Commit**

```bash
git add .claude/commands/apply.md
git commit -m "feat(apply): ask about thin profile spots before evaluating fit"
```

---

### Task 5: Known Gaps pruning in /expand

**Files:**
- Modify: `.claude/commands/expand.md` (Step 5, "Write Confirmed Additions", specifically the Technical Skills addition described around line 176)

**Interfaces:**
- Consumes: the Known Gaps table format and Pruning Rule from `10-thin-spot-detection.md` (Task 1).
- Produces: nothing new consumed elsewhere — leaf wiring task.

- [ ] **Step 1: Read the current Step 5 content**

Read `.claude/commands/expand.md` lines 171-190 to see the exact current
wording of the "Additions to `profiles/<name>/skills/01-candidate-profile.md`"
subsection before editing, so the new sentence matches its style.

- [ ] **Step 2: Insert the pruning instruction**

Immediately after the existing bullet "Technical skills (primary and
secondary) → append to the Technical Skills section" (line 176), insert a
new bullet:

```markdown
- After appending any Technical Skills entry, check the profile's `## Known
  Gaps` table (see `.claude/skills/job-application-assistant/10-thin-spot-detection.md`'s
  Pruning Rule): delete any row whose `Gap` matches the newly added skill
  (case-insensitive).
```

- [ ] **Step 3: Verify the insertion**

Read the modified section back and confirm the new bullet sits directly
under the Technical Skills bullet it depends on, and the rest of Step 5
(Behavioral Profile additions, Summary Report in Step 6) is unchanged.

- [ ] **Step 4: Trace a worked example**

Simulate: candidate's Known Gaps table has a row `Kubernetes | 2026-08-09 |
declined`. Running `/expand` later discovers Kubernetes experience from a
GitHub repo and appends it to Technical Skills. Confirm the new bullet's
instruction results in the Kubernetes row being deleted from Known Gaps in
the same write — matching the spec's self-healing requirement.

- [ ] **Step 5: Commit**

```bash
git add .claude/commands/expand.md
git commit -m "feat(expand): prune Known Gaps entries when a skill is added"
```

---

### Task 6: Known Gaps pruning in /setup

**Files:**
- Modify: `.claude/commands/setup.md` (Step A7, "Write Confirmed Changes and Fill Gaps", and Step 3 item 2, "Populate `01-candidate-profile.md`")

**Interfaces:**
- Consumes: the Known Gaps table format and Pruning Rule from `10-thin-spot-detection.md` (Task 1).
- Produces: nothing new consumed elsewhere — leaf wiring task, final task in this plan.

- [ ] **Step 1: Read the current Step A7 and Step 3 item 2 content**

Read `.claude/commands/setup.md` around lines 220-237 (Step A7) and lines
344-346 (Step 3 item 2) to see current wording before editing.

- [ ] **Step 2: Insert the pruning instruction in Step A7 (Path A)**

At the end of Step A7's content (after its existing instructions for
writing confirmed changes), add:

```markdown

If any Technical Skills entries are being written in this step, and the
profile's `01-candidate-profile.md` already has a `## Known Gaps` table
(see `.claude/skills/job-application-assistant/10-thin-spot-detection.md`'s
Pruning Rule), delete any row whose `Gap` matches a skill being added
(case-insensitive), in the same write.
```

- [ ] **Step 3: Insert the pruning instruction in Step 3 item 2 (Path B/C)**

At the end of Step 3 item 2's content (`Write the full candidate profile
with structured sections...`), add:

```markdown
 If a `## Known Gaps` table already exists in this profile (unusual on a
fresh setup, but possible after `/reset` partially preserved data), apply
the same pruning rule as `/expand`: delete any row whose `Gap` matches a
skill being written here.
```

- [ ] **Step 4: Verify both insertions**

Read `.claude/commands/setup.md` back and confirm both additions sit at the
end of their respective existing steps without altering any surrounding
text, and that Step 4 ("Confirm & Next Steps") and everything after it is
unchanged.

- [ ] **Step 5: Trace a worked example**

Simulate a `/setup` re-run (Path A, documents folder) where a candidate's
existing `01-candidate-profile.md` already has a Known Gaps row for
"Terraform | declined" and the newly parsed documents show Terraform
experience being added to Technical Skills in Step A7. Confirm the new
instruction removes the stale row in the same write.

- [ ] **Step 6: Commit**

```bash
git add .claude/commands/setup.md
git commit -m "feat(setup): prune Known Gaps entries when a skill is added"
```

---

## Self-Review Notes

- **Spec coverage:** Detection Rules (Task 1) ✓, Known Gaps Table (Tasks 1-2) ✓, Q&A Construction incl. cap-of-5 and recurrence rule (Task 1, wired in Tasks 3-4) ✓, Profile Write Rules (Task 1, wired in Tasks 3-4) ✓, self-healing/pruning (Task 1, wired in Tasks 5-6) ✓, `/scrape` and scoring weights explicitly untouched (Global Constraints) ✓.
- **No placeholders:** every task's inserted markdown is the literal final text, not a description of it.
- **Type/name consistency:** `10-thin-spot-detection.md`'s five anchor names (Detection Rules, Known Gaps Table, Q&A Construction, Profile Write Rules, Pruning Rule) are referenced identically by name in Tasks 3-6; the Known Gaps table's three columns (`Gap`, `Asked`, `Status`) and two `Status` values (`declined`, `unknown`) are used identically everywhere they appear.
