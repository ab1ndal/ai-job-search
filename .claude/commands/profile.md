# /profile - Switch and Inspect Candidate Profiles

This repo serves two candidates with separate job searches. This command shows which profile is
active, switches it, scaffolds a new one, and prints a merged view across all of them.

Path and resolution rules are defined once in `.claude/PROFILES.md`. Read that file before acting;
do not restate or reinvent its rules here.

Follow these steps **in order**.

---

## Step 0: Parse Input

`$ARGUMENTS` may contain:

- Nothing -> Step 1 (show active profile and per-profile counts)
- `use <name>` -> Step 2
- `new <name>` -> Step 3
- `status` -> Step 4

Any other input: say what the valid forms are and stop.

---

## Step 1: `/profile` - show

1. Resolve the active profile per `.claude/PROFILES.md`. If none is set, list the directories under
   `profiles/` and tell the user to run `/profile use <name>`, then stop. If `profiles/` does not
   exist at all (fresh clone), say no profiles exist yet and point at `/profile new <name>`, then
   stop.
2. Print `Profile: <name>` as the first line.
3. For **every** directory under `profiles/`, read its `tracker.csv` (skip, with a note, if absent)
   and report: total rows, open count, final count, and the date of the most recent row.
   Open vs final is decided by the **Tracker status vocabulary** block in
   `.claude/commands/outcome.md`. That block is the only definition; do not restate the values here.
4. Mark the active profile in the output.

---

## Step 2: `/profile use <name>`

1. Verify `profiles/<name>/` exists. If not, list the valid names and stop - do not create it, and
   do not fall back to another profile.
2. Write `<name>`, followed by a newline, as the entire contents of `.active-profile`. This is the
   only file this step writes. Change nothing else - no tracker, no skills file, no other
   profile's data.
3. Print `Profile: <name>` and one line naming the tracker now in effect
   (`profiles/<name>/tracker.csv`).

---

## Step 3: `/profile new <name>`

1. Reject a name that is not lowercase letters, digits, hyphens, or underscores. Reject a name whose
   directory already exists.
2. Create `profiles/` first if it does not exist yet (fresh clone), then create this skeleton:

   ```
   profiles/<name>/PROFILE.md
   profiles/<name>/skills/{01-candidate-profile,02-behavioral-profile,03-writing-style,04-job-evaluation,search-queries}.md
   profiles/<name>/tracker.csv
   profiles/<name>/cv/
   profiles/<name>/cover_letters/
   profiles/<name>/documents/{applications,postings,cv,linkedin,diplomas,references,interview}/
   profiles/<name>/job_scraper/
   ```

3. Copy the five `skills/` files verbatim from their repo-root placeholder masters:
   `.claude/skills/job-application-assistant/01-candidate-profile.md`,
   `.claude/skills/job-application-assistant/02-behavioral-profile.md`,
   `.claude/skills/job-application-assistant/03-writing-style.md`,
   `.claude/skills/job-application-assistant/04-job-evaluation.md`, and
   `.claude/skills/job-scraper/search-queries.md`. Copy, never move - the masters stay in place for
   the next profile.
4. Write `tracker.csv` with the standard header and no rows:

   ```
   date,company,sector,role,role_type,channel,status,contact_person,fit_rating,notes,cv_file,cover_letter_file,source
   ```

5. Write `PROFILE.md` with a one-line placeholder identity block noting that `/setup` fills it.
6. Do **not** switch to the new profile. Tell the user to run `/profile use <name>` and then
   `/setup`.

---

## Step 4: `/profile status` - merged view

1. Read `tracker.csv` from every directory under `profiles/`.
2. Print one table, sorted by date descending, with columns: profile, date, company, role, status.
3. Below it, per profile, print open and final counts, classified per the **Tracker status
   vocabulary** block in `.claude/commands/outcome.md` (accept the legacy space spellings on read).
4. This step is read-only. Never write to any `tracker.csv` from here - `/outcome` owns writes.
