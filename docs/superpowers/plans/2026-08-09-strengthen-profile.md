# /strengthen-profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/strengthen-profile`, a command that audits LinkedIn and the master CV for structural completeness and presentation quality, asks the candidate a short targeted Q&A for anything only they can answer, and writes grounded suggestions (a LinkedIn copy-paste file, confirmed CV edits).

**Architecture:** A single new markdown command file, `.claude/commands/strengthen-profile.md`, following this repo's existing command conventions (profile resolution, grounding rules, targeted Edit-tool writes) — no new reference docs, no code, no wiring into any other command.

**Tech Stack:** Markdown prompt file only. No test runner — verified by manual worked-example trace, the same method used throughout this repo's command files.

## Global Constraints

- Spec source of truth: `docs/superpowers/specs/2026-08-09-strengthen-profile-design.md`. Do not deviate from the checklist items, Q&A scope, or grounding rule defined there.
- Never touches `.claude/skills/upskill/SKILL.md`, `.claude/commands/expand.md`, or `.claude/commands/setup.md` — this command reads the same LinkedIn export those commands already parse, but does not re-derive or duplicate their extraction logic, and does not modify them.
- Only the master CV (`profiles/<name>/cv/main.tex`) is in scope — never a tailored per-job CV (`cv/main_<company>_<role>.tex`).
- Every suggested word (LinkedIn copy, CV edits) must trace to `01-candidate-profile.md`, `PROFILE.md`, or the master CV — no fabricated claims.
- `profiles/<name>/documents/linkedin_suggestions.txt` is overwritten fresh each run — not an append-only archive.

---

### Task 1: `/strengthen-profile` command

**Files:**
- Create: `.claude/commands/strengthen-profile.md`

**Interfaces:**
- Consumes: `profiles/<name>/documents/linkedin/` export, `profiles/<name>/skills/01-candidate-profile.md`, `profiles/<name>/skills/02-behavioral-profile.md`, `profiles/<name>/PROFILE.md`, `profiles/<name>/cv/main.tex` (all existing files, read-only except where the command explicitly edits `01-candidate-profile.md` and `cv/main.tex` per its own flow).
- Produces: `profiles/<name>/documents/linkedin_suggestions.txt` (new runtime artifact, not consumed by any other command in this plan or the existing codebase).

- [ ] **Step 1: Write the command file**

```markdown
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
```

- [ ] **Step 2: Trace a worked example**

Construct a test scenario: a LinkedIn export with no About section and 3 skills listed, and a `cv/main.tex` missing a bullet that `01-candidate-profile.md` documents in full for one role. Confirm, reading the command file just written:
- Step 2 flags "About section" (absent) and "Skills list" (3 < 5), and does not flag Headline or Recommendations if those pass.
- Step 3 flags "Experience coverage" for the missing bullet's role, citing the `01-candidate-profile.md` content that should fill it.
- Step 4 does not ask about the About section or skills list (both have self-evident fixes from data already in hand) — only asks about photo, custom URL, and any work-history gap if one exists in this scenario.
- Step 5 writes `linkedin_suggestions.txt` with headline options and an About-section draft grounded in the profile, and proposes the missing CV bullet as a diff, applying it only if confirmed.

If any step's logic is ambiguous or doesn't hold under this trace, fix the file before proceeding.

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/strengthen-profile.md
git commit -m "feat(commands): add /strengthen-profile LinkedIn and CV advisor"
```

---

## Self-Review Notes

- **Spec coverage:** LinkedIn checklist (Step 2) ✓, CV checklist (Step 3) ✓, unified report ✓, narrow Q&A scope ✓ (Step 4), grounded suggestions + `linkedin_suggestions.txt` + confirmed CV diffs ✓ (Step 5), new-fact write-back ✓ (Step 4), grounding rule stated as a standalone Important Rule ✓, non-goals (`/upskill` market-fit, `/expand` ingestion, live-LinkedIn automation, tailored per-job CVs, no Known-Gaps-style persistent tracking) all explicitly excluded in the command's opening paragraph and Global Constraints.
- **No placeholders:** the command file content is the literal final text, not a description of it.
- **Type/name consistency:** N/A — single markdown file, no cross-file interfaces to keep consistent.
