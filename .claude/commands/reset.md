# /reset - Reset Candidate Profile Data

You are resetting parts of the job search framework back to a blank state so the user can start fresh with `/setup`.

**This command is destructive.** Nothing is deleted until the user explicitly confirms. Follow these steps exactly in order.

**Every deletion in this command is scoped to the single resolved profile below. `/reset` never
touches another profile's directory** — it reads and writes only inside `profiles/<name>/`, never
`profiles/<other-name>/`, regardless of scope.

---

## Step 0: Resolve Profile, then Parse Scope from Arguments

**Profile:** resolve the active candidate profile per `.claude/PROFILES.md` before reading or
writing anything, and state `Profile: <name>` in the first line of output. `<name>` in the paths
below is that resolved profile. Every step that follows operates only inside `profiles/<name>/`.

Check `$ARGUMENTS` for a scope keyword:

- `profile` — clears candidate profile data from skill files only
- `documents` — deletes user-provided files from the `profiles/<name>/documents/` folder only
- `all` — both of the above

If `$ARGUMENTS` is empty or does not contain a recognized scope keyword, ask:

> **What would you like to reset?**
>
> - **`profile`** — Clears candidate data from the skill files (profile, behavioral, STAR examples, profile statements). The framework structure and writing rules are preserved. Use this to re-run `/setup` from scratch.
>
> - **`documents`** — Deletes all files you've placed in the `profiles/<name>/documents/` folder (CV PDFs, LinkedIn export, diplomas, references, past applications). The folder structure is preserved.
>
> - **`all`** — Both of the above.
>
> Reply with `profile`, `documents`, or `all`.

Wait for the user's response before continuing.

---

## Step 1: Show Exactly What Will Be Cleared

Before doing anything, show the user precisely what will be wiped.

### If scope includes `profile`:

Read the current state of these files and report whether each has content or is already empty:

- `profiles/<name>/skills/01-candidate-profile.md`
- `profiles/<name>/skills/02-behavioral-profile.md`
- `.claude/skills/job-application-assistant/05-cv-templates.md` *(profile statements section only — framework structure is preserved)*
- `.claude/skills/job-application-assistant/07-interview-prep.md` *(STAR examples and STAR candidates sections only — framework structure is preserved)*

Present as:

```
## Profile reset will clear (profile: <name>):

- profiles/<name>/skills/01-candidate-profile.md — [has content / already empty]
  Full file will be replaced with a blank template.

- profiles/<name>/skills/02-behavioral-profile.md — [has content / already empty]
  Full file will be replaced with a blank template.

- 05-cv-templates.md — [has profile statements / already blank]
  Profile statement templates will be cleared. LaTeX structure and tailoring guidelines are preserved.

- 07-interview-prep.md — [has STAR examples / already blank]
  STAR examples and any STAR candidate stubs will be cleared. Framework, tough questions, and roleplay guidelines are preserved.

The following files are NOT touched (they contain framework rules, not candidate data):
  - 03-writing-style.md
  - 04-job-evaluation.md
  - 06-cover-letter-templates.md
```

### If scope includes `documents`:

Use Glob to list all files present in `profiles/<name>/documents/cv/`, `profiles/<name>/documents/linkedin/`, `profiles/<name>/documents/diplomas/`, `profiles/<name>/documents/references/`, and `profiles/<name>/documents/applications/`. Present as:

```
## Documents reset will delete (profile: <name>):

profiles/<name>/documents/cv/
  - [filename] or "(empty)"

profiles/<name>/documents/linkedin/
  - [filename] or "(empty)"

profiles/<name>/documents/diplomas/
  - [filename] or "(empty)"

profiles/<name>/documents/references/
  - [filename] or "(empty)"

profiles/<name>/documents/applications/
  - [subfolder/filename] or "(empty)"

documents/README.md — NOT deleted (shared instructions file, outside any profile)
```

If all document subfolders are already empty, state "All document subfolders are already empty — nothing to delete." and skip the confirmation step for this scope.

---

## Step 2: Require Explicit Confirmation

Present the confirmation prompt, echoing the resolved profile name so the user can see exactly which candidate's data is about to be wiped before anything is deleted:

> **This cannot be undone. Profile: `<name>`.**
>
> This will only affect `profiles/<name>/` — no other profile's data is touched.
>
> Type **`RESET <name>`** (matching the profile name above) to confirm, or anything else to cancel.

Wait for the user's response.

- If the user types exactly `RESET <name>` with `<name>` matching the resolved profile: proceed to Step 3.
- If the user types anything else, including `RESET` alone or `RESET` with a different profile name: abort and tell them "Reset cancelled. Nothing was changed."

---

## Step 3: Execute the Reset

### Profile reset

**For `profiles/<name>/skills/01-candidate-profile.md`**, replace the file content with:

```markdown
# Candidate Profile

<!-- Run /setup to populate this file -->

## Identity

## Education

## Professional Experience

## Independent Projects

## Technical Skills

## Publications

## Awards

## References
```

**For `profiles/<name>/skills/02-behavioral-profile.md`**, replace the file content with:

```markdown
# Behavioral Profile

<!-- Run /setup to populate this file -->

## Overview

## Strongest Behavioral Traits

## How I Work Best

## Growth Areas

## Mapping to Job Posting Language

## Management Style Preferences

## Using This in Applications
```

**For `05-cv-templates.md`**, locate the section that begins with `**Profile statement templates` and extends through the role-specific template blocks. Replace only that section with:

```markdown
**Profile statement templates:**

<!-- Run /setup to populate role-specific profile statements -->
```

Leave all other content in `05-cv-templates.md` intact.

**For `07-interview-prep.md`**, locate and remove:
- The entire `## Ready-Made STAR Examples` section and all numbered STAR examples under it
- Any `## STAR Candidates (Complete Manually)` section added by `/setup` Path A

Replace with:

```markdown
## Ready-Made STAR Examples

<!-- Run /setup to populate STAR examples from your actual experience -->
```

Leave all other content in `07-interview-prep.md` intact (STAR format explanation, tough questions, questions to ask interviewers, phone/video tips, follow-up etiquette, roleplay guidelines).

### Documents reset

For each non-empty document subfolder, delete all files within it using Bash `rm`, scoped strictly to `profiles/<name>/documents/`. Do not delete the folder itself, do not delete `documents/README.md` (shared, outside any profile), and never touch `profiles/<other-name>/documents/`.

```bash
rm -f profiles/<name>/documents/cv/*
rm -f profiles/<name>/documents/linkedin/*
rm -f profiles/<name>/documents/diplomas/*
rm -f profiles/<name>/documents/references/*
rm -rf profiles/<name>/documents/applications/*/
```

---

## Step 4: Confirm What Was Done and Next Steps

After the reset is complete, report:

```
## Reset complete

### Cleared
[List each file/folder that was actually modified or cleared]

### Unchanged
[List anything that was already empty or was intentionally preserved]
```

Then tell the user what to do next based on what was reset:

**If profile was reset:**
> Your candidate profile is now blank. Run `/setup` to repopulate it. The command auto-detects any files in your `profiles/<name>/documents/` folder and offers to read from there; otherwise it walks you through a CV import or interactive interview.

**If documents were reset:**
> The `profiles/<name>/documents/` folder is now empty. Add your career documents and run `/setup` to populate your profile. See `documents/README.md` for instructions on what to put where.

**If both were reset:**
> Both your profile files and documents folder are now empty. Add documents to `profiles/<name>/documents/` (or skip and use the CV import / interview path), then run `/setup`.
