# Multi-Profile Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let two candidates (`abhinav`, `anushka`) run fully separate job searches from this one repo, switchable with a single command, with no shared mutable state.

**Architecture:** Every per-candidate artifact moves under `profiles/<name>/`. Commands and skills are markdown specs, so "implementation" means rewriting the ~90 hardcoded root paths inside them to `profiles/<name>/…`, with the profile resolved by a rule defined once in `.claude/PROFILES.md` (`--profile <name>` → `.active-profile` → hard error). Tests are doc-spec tests in the repo's existing style (`tests/test_tracker_status_vocab.py` is the model): they read the markdown and assert invariants.

**Tech Stack:** Markdown command/skill specs, Python 3 `unittest` (run via `python -m unittest discover -s tests -t .`), `tools/security_guards.py` (gitignore rule assertions), `tools/lint_skills.py` (command/skill header lint), LaTeX (lualatex for CV, xelatex for cover letters).

**Spec:** `docs/superpowers/specs/2026-08-08-multi-profile-design.md`

## Global Constraints

- Profile names in scope: `abhinav`, `anushka`. Directory name == profile name, lowercase.
- Profile root is `profiles/<name>/`. Derived paths, exact spellings: `profiles/<name>/tracker.csv`, `profiles/<name>/skills/`, `profiles/<name>/cv/`, `profiles/<name>/cover_letters/`, `profiles/<name>/documents/<sub>/`, `profiles/<name>/job_scraper/`, `profiles/<name>/upskill/`, `profiles/<name>/gmail_sync/`, `profiles/<name>/reports/`.
- Scope addition found during Task 8 (Task 8b): several converted specs still READ the five personalized files from their repo-root master paths (`.claude/skills/job-application-assistant/01-…`, `.claude/skills/job-scraper/search-queries.md`) instead of `profiles/<name>/skills/`. Known sites: `rank.md`, `interview.md`, `upskill/SKILL.md`, `add-portal.md`. The audit patterns did not cover this class, which is why the conversions passed. `profile.md` and `.claude/PROFILES.md` legitimately name the masters and are exempt.
- Scope addition found during Task 5 (not in the original inventory): `upskill/report-*.md`, `gmail_sync/state.json`, and `reports/application-dashboard.html` are per-candidate outputs and must be profile-scoped too. `upskill/` belongs to Task 5, `gmail_sync/` and `reports/` to Task 7, and all three join the audit patterns.
- Per-profile skill files, exactly five: `01-candidate-profile.md`, `02-behavioral-profile.md`, `03-writing-style.md`, `04-job-evaluation.md`, `search-queries.md`.
- Shared and staying at the repo root, never profile-scoped: `cv/main_example.tex`, `cover_letters/cover_example.tex`, `cover_letters/cover.cls`, `cover_letters/OpenFonts/**`, `templates/`, `documents/README.md`, and the repo-root copies of the five per-profile skill files (they remain placeholder masters that `/profile new` copies from; nothing reads them at runtime).
- Tracker status vocabulary has one definition, in `.claude/commands/outcome.md` ("Tracker status vocabulary"). Never restate it; defer to it. Canonical: `drafted | applied | interview | offer | hired | rejected | no_response | offer_declined | withdrawn`; legacy space spellings `no response` / `offer declined` accepted on read only.
- Nothing under `profiles/` or `.active-profile` may ever be committed.
- Every profile-resolving command states the resolved profile name in its first line of output.
- An unknown or missing profile is a hard error listing valid profiles. Never fall back to another profile.
- Repo `.gitignore` contains `docs/`, so plan and spec files are committed with `git add -f`.
- Test runner: `python -m unittest discover -s tests -t . -v`. Individual test: `python -m unittest tests.test_x.ClassName.test_name -v`.
- Commit after every task. Commit messages: imperative summary ≤72 chars, body explains why.

---

### Task 1: Profile resolution contract

Defines, in one place, how any command finds the active profile. Everything later links here instead of restating it.

**Files:**
- Create: `.claude/PROFILES.md`
- Test: `tests/test_profile_resolution.py`

**Interfaces:**
- Consumes: nothing.
- Produces: the anchors later tasks and tests depend on — headings `## Resolution order`, `## Profile paths`, `## Error behavior`; the literal path table rows listed in Global Constraints; the phrase `.active-profile`.

- [ ] **Step 1: Write the failing test**

Create `tests/test_profile_resolution.py`:

```python
"""Guards for the profile resolution contract.

Commands are markdown specs, so the contract IS the implementation. These
tests pin the parts other specs link to: the three-step resolution order,
the derived path table, and the refusal to fall back to another profile
(which would silently draft one candidate's CV from the other's data).
"""
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PROFILES = REPO / ".claude" / "PROFILES.md"

REQUIRED_PATH_ROWS = [
    "profiles/<name>/tracker.csv",
    "profiles/<name>/skills/",
    "profiles/<name>/cv/",
    "profiles/<name>/cover_letters/",
    "profiles/<name>/documents/",
    "profiles/<name>/job_scraper/",
]

PER_PROFILE_SKILL_FILES = [
    "01-candidate-profile.md",
    "02-behavioral-profile.md",
    "03-writing-style.md",
    "04-job-evaluation.md",
    "search-queries.md",
]


class ProfileResolutionContract(unittest.TestCase):
    def setUp(self):
        self.text = PROFILES.read_text(encoding="utf-8")

    def test_file_exists_with_required_sections(self):
        for heading in ("## Resolution order", "## Profile paths", "## Error behavior"):
            self.assertIn(heading, self.text, f"missing section {heading}")

    def test_resolution_order_is_argument_then_file_then_error(self):
        order = self.text.split("## Resolution order", 1)[1]
        arg = order.find("--profile")
        active = order.find(".active-profile")
        self.assertGreater(arg, -1, "resolution order must mention --profile")
        self.assertGreater(active, -1, "resolution order must mention .active-profile")
        self.assertLess(arg, active, "--profile must take precedence over .active-profile")

    def test_declares_every_derived_path(self):
        for row in REQUIRED_PATH_ROWS:
            self.assertIn(row, self.text, f"missing derived path {row}")

    def test_lists_the_five_per_profile_skill_files(self):
        for name in PER_PROFILE_SKILL_FILES:
            self.assertIn(name, self.text, f"missing per-profile skill file {name}")

    def test_forbids_silent_fallback(self):
        errors = self.text.split("## Error behavior", 1)[1]
        self.assertIn("never", errors.lower())
        self.assertIn("fall back", errors.lower())

    def test_requires_commands_to_announce_resolved_profile(self):
        self.assertIn("first line of output", self.text)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests.test_profile_resolution -v`
Expected: FAIL — `FileNotFoundError: .claude/PROFILES.md`

- [ ] **Step 3: Write `.claude/PROFILES.md`**

```markdown
# Profile Resolution

This repo serves two candidates. Every command that touches candidate data resolves exactly one
profile first, and reads and writes only inside that profile's directory. This file is the single
definition of that rule - commands link here instead of restating it.

## Resolution order

1. An explicit `--profile <name>` argument on the invocation. It applies to that invocation only and
   never changes `.active-profile`.
2. The single line in `.active-profile` at the repo root.
3. Neither present -> stop. List the directories under `profiles/` and tell the user to run
   `/profile use <name>`. Do not read or write anything.

State the resolved profile name in the **first line of output**, e.g. `Profile: abhinav`. A
wrong-profile run must be visible before any document is drafted, not after.

## Profile paths

All paths are relative to the repo root, with `<name>` replaced by the resolved profile.

| What | Path |
|---|---|
| Application tracker CSV | `profiles/<name>/tracker.csv` |
| Personalized skill files | `profiles/<name>/skills/` |
| Generated CVs | `profiles/<name>/cv/` |
| Generated cover letters | `profiles/<name>/cover_letters/` |
| Application archive | `profiles/<name>/documents/applications/` |
| Saved postings | `profiles/<name>/documents/postings/` |
| Source CV, LinkedIn export, diplomas, references | `profiles/<name>/documents/{cv,linkedin,diplomas,references}/` |
| Interview material | `profiles/<name>/documents/interview/` |
| Scraper state | `profiles/<name>/job_scraper/` (`seen_jobs.json`, `notion_sync.json`, scrape reports) |
| Identity block | `profiles/<name>/PROFILE.md` |

The five personalized skill files live in `profiles/<name>/skills/`:
`01-candidate-profile.md`, `02-behavioral-profile.md`, `03-writing-style.md`,
`04-job-evaluation.md`, `search-queries.md`.

Read them from there, never from their repo-root copies. The root copies under
`.claude/skills/` are untouched placeholder masters that `/profile new` copies from.

## Shared, never profile-scoped

`cv/main_example.tex`, `cover_letters/cover_example.tex`, `cover_letters/cover.cls`,
`cover_letters/OpenFonts/`, `templates/`, `documents/README.md`. These are templates and assets,
identical for every candidate, and they stay at the repo root.

## Error behavior

- Unknown profile name: hard error listing the valid names. **Never** fall back to another profile
  or to a default - drafting one candidate's application from the other's data is the exact failure
  this design exists to prevent.
- `profiles/<name>/` exists but a required file is missing: say which file, and point at
  `/profile new` or `/setup`. Do not create a partial profile silently.
- Broken or empty `.active-profile`: treat as absent and follow step 3 of the resolution order.

## Non-interference

Every mutable artifact lives inside `profiles/<name>/`. No command writes a path another profile
reads. Switching writes one line to `.active-profile` and nothing else, so a switch cannot half
complete.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest tests.test_profile_resolution -v`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add .claude/PROFILES.md tests/test_profile_resolution.py
git commit -m "feat(profiles): define profile resolution contract

Two candidates share this repo. Resolution lives in one file so no command
invents its own rule and silently reads the wrong candidate's data."
```

---

### Task 2: `/profile` command

**Files:**
- Create: `.claude/commands/profile.md`
- Test: `tests/test_profile_command.py`

**Interfaces:**
- Consumes: `.claude/PROFILES.md` anchors from Task 1; the status vocabulary block in `.claude/commands/outcome.md`.
- Produces: the four subcommands `use`, `new`, `status`, and bare `/profile`; the scaffold file list that Task 12 relies on.

- [ ] **Step 1: Write the failing test**

Create `tests/test_profile_command.py`:

```python
"""Guards for the /profile command spec.

The command is a markdown spec, so these tests pin the invariants that would
break silently: the title format lint_skills.py enforces, the four
subcommands, deference to the single status vocabulary in /outcome, and the
scaffold list (a profile missing one of the five personalized skill files
would fall back to placeholder text mid-application).
"""
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
COMMAND = REPO / ".claude" / "commands" / "profile.md"

SUBCOMMANDS = ["/profile use", "/profile new", "/profile status"]

SCAFFOLD_ENTRIES = [
    "PROFILE.md",
    "skills/",
    "tracker.csv",
    "cv/",
    "cover_letters/",
    "documents/",
    "job_scraper/",
]


class ProfileCommandSpec(unittest.TestCase):
    def setUp(self):
        self.text = COMMAND.read_text(encoding="utf-8")

    def test_title_matches_lint_format(self):
        self.assertTrue(
            self.text.startswith("# /profile"),
            "lint_skills.py requires commands to start with '# /<name>'",
        )

    def test_documents_every_subcommand(self):
        for sub in SUBCOMMANDS:
            self.assertIn(sub, self.text, f"missing subcommand {sub}")

    def test_links_to_resolution_contract_instead_of_restating(self):
        self.assertIn(".claude/PROFILES.md", self.text)

    def test_defers_to_outcome_status_vocabulary(self):
        self.assertIn("outcome.md", self.text)
        self.assertIn("Tracker status vocabulary", self.text)

    def test_does_not_define_a_second_status_enum(self):
        # A second list of statuses drifts from /outcome's. Only the pointer is allowed.
        self.assertNotIn("`drafted` | `applied`", self.text)

    def test_new_scaffolds_every_required_entry(self):
        section = self.text.split("/profile new", 1)[1]
        for entry in SCAFFOLD_ENTRIES:
            self.assertIn(entry, section, f"/profile new must scaffold {entry}")

    def test_use_writes_only_the_pointer_file(self):
        section = self.text.split("/profile use", 1)[1]
        self.assertIn(".active-profile", section)

    def test_status_labels_rows_by_profile(self):
        section = self.text.split("/profile status", 1)[1]
        self.assertIn("profile", section.lower())
        self.assertIn("tracker.csv", section)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests.test_profile_command -v`
Expected: FAIL — `FileNotFoundError: .claude/commands/profile.md`

- [ ] **Step 3: Write `.claude/commands/profile.md`**

```markdown
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
   `profiles/` and tell the user to run `/profile use <name>`, then stop.
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
2. Write `<name>`, followed by a newline, as the entire contents of `.active-profile`. Change
   nothing else.
3. Print `Profile: <name>` and one line naming the tracker now in effect
   (`profiles/<name>/tracker.csv`).

---

## Step 3: `/profile new <name>`

1. Reject a name that is not lowercase letters, digits, hyphens, or underscores. Reject a name whose
   directory already exists.
2. Create this skeleton:

   ```
   profiles/<name>/
     PROFILE.md
     skills/
       01-candidate-profile.md
       02-behavioral-profile.md
       03-writing-style.md
       04-job-evaluation.md
       search-queries.md
     tracker.csv
     cv/
     cover_letters/
     documents/
       applications/ postings/ cv/ linkedin/ diplomas/ references/ interview/
     job_scraper/
   ```

3. Copy the five `skills/` files verbatim from their repo-root placeholder masters:
   `.claude/skills/job-application-assistant/0{1,2,3,4}-*.md` and
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest tests.test_profile_command -v`
Expected: PASS (8 tests)

- [ ] **Step 5: Verify lint accepts the new command**

Run: `python tools/lint_skills.py`
Expected: exit 0, no errors mentioning `profile.md`

- [ ] **Step 6: Commit**

```bash
git add .claude/commands/profile.md tests/test_profile_command.py
git commit -m "feat(profiles): add /profile switch, scaffold, and merged view

Switching writes one line to .active-profile so it cannot half complete;
/profile status reuses /outcome's status enum rather than defining a second."
```

---

### Task 3: Gitignore and security guards

Personal data under `profiles/` is not matched by any existing root-relative ignore rule. `tools/security_guards.py` asserts the ignore list in CI, so it must learn the new rules or it will pass while data is exposed.

**Files:**
- Modify: `.gitignore`
- Modify: `tools/security_guards.py:45-71` (`REQUIRED_IGNORE_RULES`)
- Test: `tests/test_security_guards.py` (extend)

**Interfaces:**
- Consumes: nothing.
- Produces: the ignore rules `profiles/` and `.active-profile`, relied on by Task 12's leak check.

- [ ] **Step 1: Write the failing test**

Append to `tests/test_security_guards.py`, as a new class at the end of the file (before any `if __name__ == "__main__":` block):

```python
class ProfileIgnoreRules(unittest.TestCase):
    """Personal data moved under profiles/, which no root-relative rule matches."""

    def test_guard_requires_profiles_dir_ignored(self):
        self.assertIn("profiles/", security_guards.REQUIRED_IGNORE_RULES)

    def test_guard_requires_active_profile_pointer_ignored(self):
        self.assertIn(".active-profile", security_guards.REQUIRED_IGNORE_RULES)

    def test_repo_gitignore_satisfies_both(self):
        text = (REPO_ROOT / ".gitignore").read_text(encoding="utf-8").splitlines()
        rules = {line.strip() for line in text}
        self.assertIn("profiles/", rules)
        self.assertIn(".active-profile", rules)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests.test_security_guards.ProfileIgnoreRules -v`
Expected: FAIL — `'profiles/' not found in REQUIRED_IGNORE_RULES`

- [ ] **Step 3: Add the rules**

In `tools/security_guards.py`, inside `REQUIRED_IGNORE_RULES`, immediately after the `"job_search_tracker.csv",` entry:

```python
    # Per-candidate data lives under profiles/<name>/; the root-relative rules
    # above do not match it. The pointer file names the active candidate.
    "profiles/",
    ".active-profile",
```

In `.gitignore`, append at the end of the file:

```gitignore
# Per-candidate profile data (tracker, generated documents, archive, scraper state).
# The root-relative rules above do not match these paths.
profiles/
.active-profile
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m unittest tests.test_security_guards -v`
Expected: PASS (all pre-existing tests plus the 3 new ones)

- [ ] **Step 5: Verify the guard script itself passes**

Run: `python tools/security_guards.py`
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add .gitignore tools/security_guards.py tests/test_security_guards.py
git commit -m "fix(security): ignore per-profile personal data

Existing ignore rules are root-relative and stop matching once tracker,
CVs, and the application archive move under profiles/<name>/."
```

---

### Task 4: Path audit harness

A missed reference site silently reads or writes a root path — the one failure mode of the whole rewrite. This test makes conversion mechanically checkable, one file at a time.

**Files:**
- Create: `tests/test_profile_paths.py`

**Interfaces:**
- Consumes: nothing.
- Produces: the module constant `CONVERTED_FILES: list[str]`, which Tasks 5–9 append to and Task 11 asserts is complete.

- [ ] **Step 1: Write the test**

Create `tests/test_profile_paths.py`:

```python
"""Audits that converted specs no longer reference root-relative candidate paths.

Candidate data moved under profiles/<name>/. A spec that still says
`job_search_tracker.csv` writes to a path no profile reads, so one
candidate's application silently lands outside both trackers.

Conversion is incremental: a file is added to CONVERTED_FILES by the task
that converts it. test_profile_paths_complete (Task 11) pins the final set.
"""
import re
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# Root-relative paths that must not survive in a converted file.
FORBIDDEN = [
    re.compile(r"(?<!/)job_search_tracker\.csv"),
    re.compile(r"(?<!/)documents/(applications|postings|linkedin|diplomas|references|interview)"),
    re.compile(r"(?<!/)documents/cv\b"),
    re.compile(r"(?<!/)job_scraper/"),
    re.compile(r"(?<!/)cv/main_(?!example)"),
    re.compile(r"(?<!/)cover_letters/[cC]over_(?!example)"),
]

# Shared assets that legitimately keep their root paths everywhere.
ALLOWED_SUBSTRINGS = [
    "cv/main_example.tex",
    "cover_letters/cover_example.tex",
    "cover_letters/cover.cls",
    "cover_letters/OpenFonts",
    "documents/README.md",
]

# Appended to by each conversion task.
CONVERTED_FILES: list[str] = []


def offending_lines(rel_path: str) -> list[str]:
    path = REPO / rel_path
    hits = []
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        stripped = line
        for allowed in ALLOWED_SUBSTRINGS:
            stripped = stripped.replace(allowed, "")
        if any(pattern.search(stripped) for pattern in FORBIDDEN):
            hits.append(f"{rel_path}:{number}: {line.strip()}")
    return hits


class ConvertedFilesUseProfilePaths(unittest.TestCase):
    def test_no_root_relative_candidate_paths(self):
        hits = []
        for rel_path in CONVERTED_FILES:
            hits.extend(offending_lines(rel_path))
        self.assertEqual(hits, [], "root-relative candidate paths survive:\n" + "\n".join(hits))

    def test_converted_files_exist(self):
        for rel_path in CONVERTED_FILES:
            self.assertTrue((REPO / rel_path).is_file(), f"missing {rel_path}")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run it to confirm the harness is green on an empty set**

Run: `python -m unittest tests.test_profile_paths -v`
Expected: PASS (2 tests, trivially — `CONVERTED_FILES` is empty)

- [ ] **Step 3: Prove the harness actually catches a violation**

Temporarily set `CONVERTED_FILES = [".claude/commands/rank.md"]`, then run:

Run: `python -m unittest tests.test_profile_paths -v`
Expected: FAIL, listing `job_search_tracker.csv` and `job_scraper/seen_jobs.json` hits in `rank.md`

Then remove that entry again and re-run — expected PASS. A harness that cannot fail is worthless; this step is the proof.

- [ ] **Step 4: Commit**

```bash
git add tests/test_profile_paths.py
git commit -m "test(profiles): add incremental root-path audit harness

A missed reference site is the one silent failure mode of the rewrite, so
each conversion task registers its files and this test pins them."
```

---

### Task 5: Convert tracker and scraper-state readers

**Files:**
- Modify: `.claude/commands/rank.md` (5 sites), `.claude/skills/job-scraper/SKILL.md` (4 sites), `.claude/skills/upskill/SKILL.md` (6 sites)
- Modify: `tests/test_profile_paths.py` (`CONVERTED_FILES`)

**Interfaces:**
- Consumes: `.claude/PROFILES.md` (Task 1).
- Produces: converted `rank.md`, `job-scraper/SKILL.md`, `upskill/SKILL.md`.

- [ ] **Step 1: Register the files in the audit test**

In `tests/test_profile_paths.py`, set:

```python
CONVERTED_FILES: list[str] = [
    ".claude/commands/rank.md",
    ".claude/skills/job-scraper/SKILL.md",
    ".claude/skills/upskill/SKILL.md",
]
```

- [ ] **Step 2: Run the audit to see it fail**

Run: `python -m unittest tests.test_profile_paths -v`
Expected: FAIL, listing ~15 root-path hits across the three files

- [ ] **Step 3: Convert the paths**

In each of the three files, apply these substitutions:

| Before | After |
|---|---|
| `job_search_tracker.csv` | `profiles/<name>/tracker.csv` |
| `job_scraper/seen_jobs.json` | `profiles/<name>/job_scraper/seen_jobs.json` |
| `job_scraper/notion_sync.json` | `profiles/<name>/job_scraper/notion_sync.json` |

Then, in each file's Step 0 (or, for the two `SKILL.md` files, immediately after the opening
paragraph), insert this block verbatim:

```markdown
**Profile:** resolve the active candidate profile per `.claude/PROFILES.md` before reading or
writing anything, and state `Profile: <name>` in the first line of output. `<name>` in the paths
below is that resolved profile.
```

Additionally, in `.claude/skills/job-scraper/SKILL.md`, change every reference to the search-query
file `search-queries.md` to `profiles/<name>/skills/search-queries.md`.

- [ ] **Step 4: Run the audit to verify it passes**

Run: `python -m unittest tests.test_profile_paths -v`
Expected: PASS

- [ ] **Step 5: Run the full suite (catches the coupled assertions)**

Run: `python -m unittest discover -s tests -t . -v`
Expected: PASS except possibly `tests.test_rank_command` — if it fails on a path string, update that
assertion to the new `profiles/<name>/…` spelling in this task, then re-run.

- [ ] **Step 6: Commit**

```bash
git add .claude/commands/rank.md .claude/skills/job-scraper/SKILL.md .claude/skills/upskill/SKILL.md tests/
git commit -m "refactor(profiles): scope tracker and scraper state per profile

/rank, /scrape, and /upskill share dedup state; keeping it at the root
would merge two candidates' seen-jobs history into one."
```

---

### Task 6: Convert `/apply`

The largest file (19 sites) and the one where a wrong path produces the worst outcome: the other candidate's CV attached to an application.

**Files:**
- Modify: `.claude/commands/apply.md`
- Modify: `tests/test_profile_paths.py` (`CONVERTED_FILES`)
- Modify: `tests/test_apply_records_application.py:113` (path assertion)

**Interfaces:**
- Consumes: `.claude/PROFILES.md` (Task 1).
- Produces: converted `apply.md` with the generated-document naming used by Tasks 7 and 9: `profiles/<name>/cv/main_<company>_<role><CV_EXT>` and `profiles/<name>/cover_letters/cover_<company>_<role><COVER_EXT>`.

- [ ] **Step 1: Register the file in the audit test**

Append `".claude/commands/apply.md"` to `CONVERTED_FILES` in `tests/test_profile_paths.py`.

- [ ] **Step 2: Run the audit to see it fail**

Run: `python -m unittest tests.test_profile_paths -v`
Expected: FAIL, listing ~13 hits in `apply.md` (the four `cv/main_example.tex` mentions are allowed and must NOT appear)

- [ ] **Step 3: Convert the paths**

| Before | After |
|---|---|
| `job_search_tracker.csv` | `profiles/<name>/tracker.csv` |
| `job_scraper/seen_jobs.json` | `profiles/<name>/job_scraper/seen_jobs.json` |
| `cv/main_<COMPANY>_<ROLE><CV_EXT>` | `profiles/<name>/cv/main_<COMPANY>_<ROLE><CV_EXT>` |
| `cv/main_<company>_<role><CV_EXT>` | `profiles/<name>/cv/main_<company>_<role><CV_EXT>` |
| `cv/main_<company>_<role>.pdf` | `profiles/<name>/cv/main_<company>_<role>.pdf` |
| `cv/main_*<CV_EXT>` | `profiles/<name>/cv/main_*<CV_EXT>` |
| `cover_letters/cover_<COMPANY>_<ROLE><COVER_EXT>` | `profiles/<name>/cover_letters/cover_<COMPANY>_<ROLE><COVER_EXT>` |
| `cover_letters/cover_<company>_<role><COVER_EXT>` | `profiles/<name>/cover_letters/cover_<company>_<role><COVER_EXT>` |
| `cover_letters/cover_<company>_<role>.pdf` | `profiles/<name>/cover_letters/cover_<company>_<role>.pdf` |
| `cover_letters/cover_*<COVER_EXT>` and `cover_letters/Cover_*<COVER_EXT>` | `profiles/<name>/cover_letters/cover_*<COVER_EXT>` and `profiles/<name>/cover_letters/Cover_*<COVER_EXT>` |
| `documents/applications/<company>_<role>/` | `profiles/<name>/documents/applications/<company>_<role>/` |
| `documents/postings/` | `profiles/<name>/documents/postings/` |

Leave every `cv/main_example.tex` mention exactly as is — it is the shared template.

Insert the same **Profile:** block from Task 5 Step 3 into `apply.md`'s Step 0.

Where `apply.md` says to read the candidate profile, behavioral profile, writing style, or evaluation
framework, point at `profiles/<name>/skills/01-candidate-profile.md`,
`profiles/<name>/skills/02-behavioral-profile.md`, `profiles/<name>/skills/03-writing-style.md`, and
`profiles/<name>/skills/04-job-evaluation.md` respectively.

- [ ] **Step 4: Fix the coupled existing test**

In `tests/test_apply_records_application.py:113`, change the expected string
`"Do not modify `job_scraper/seen_jobs.json`"` to
`"Do not modify `profiles/<name>/job_scraper/seen_jobs.json`"` — matching the exact new wording in
`apply.md`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `python -m unittest tests.test_profile_paths tests.test_apply_records_application -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add .claude/commands/apply.md tests/
git commit -m "refactor(profiles): scope /apply documents and tracker per profile

Drafting reads the candidate's own profile files and writes into that
candidate's directories, so one applicant's CV can never be attached to
the other's application."
```

---

### Task 7: Convert the archive and sync commands

**Files:**
- Modify: `.claude/commands/outcome.md` (11 sites), `.claude/commands/interview.md` (6), `.claude/commands/gmail-sync.md` (7), `.claude/commands/html-report.md` (4), `.claude/commands/notion-sync.md` (8)
- Modify: `tests/test_profile_paths.py` (`CONVERTED_FILES`)
- Modify: `tests/test_notion_sync_command.py:41` (path assertion)

**Interfaces:**
- Consumes: naming from Task 6.
- Produces: converted archive/sync commands.

- [ ] **Step 1: Register the five files in the audit test**

Append to `CONVERTED_FILES`:

```python
    ".claude/commands/outcome.md",
    ".claude/commands/interview.md",
    ".claude/commands/gmail-sync.md",
    ".claude/commands/html-report.md",
    ".claude/commands/notion-sync.md",
```

- [ ] **Step 2: Run the audit to see it fail**

Run: `python -m unittest tests.test_profile_paths -v`
Expected: FAIL, listing ~36 hits across the five files

- [ ] **Step 3: Convert the paths**

Apply in all five files:

| Before | After |
|---|---|
| `job_search_tracker.csv` | `profiles/<name>/tracker.csv` |
| `documents/applications` | `profiles/<name>/documents/applications` |
| `documents/interview` | `profiles/<name>/documents/interview` |
| `job_scraper/seen_jobs.json` | `profiles/<name>/job_scraper/seen_jobs.json` |
| `job_scraper/notion_sync.json` | `profiles/<name>/job_scraper/notion_sync.json` |
| `cv/main_<company>*.tex` | `profiles/<name>/cv/main_<company>*.tex` |
| `cover_letters/cover_<company>_*.tex` | `profiles/<name>/cover_letters/cover_<company>_*.tex` |

Insert the **Profile:** block from Task 5 Step 3 into each file's Step 0.

Do not touch the "Tracker status vocabulary" block in `outcome.md` — it stays the single definition,
unchanged.

In `notion-sync.md`, note that `notion_sync.json` is per profile, so the same Notion database
receives rows from both profiles only if the user points them at the same database; the sync state
that prevents duplicate pushes is per profile.

- [ ] **Step 4: Fix the coupled existing test**

In `tests/test_notion_sync_command.py:41`, change `"job_scraper/notion_sync.json"` to
`"profiles/<name>/job_scraper/notion_sync.json"`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `python -m unittest tests.test_profile_paths tests.test_notion_sync_command tests.test_tracker_status_vocab tests.test_outcome_followup tests.test_html_report_command -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add .claude/commands/outcome.md .claude/commands/interview.md .claude/commands/gmail-sync.md .claude/commands/html-report.md .claude/commands/notion-sync.md tests/
git commit -m "refactor(profiles): scope archive and sync commands per profile

Application archive, tracker writes, and sync state are per candidate;
merged reporting stays read-only in /profile status."
```

---

### Task 8: Convert the setup, reset, expand, and template commands

**Files:**
- Modify: `.claude/commands/expand.md` (8 sites), `.claude/commands/reset.md` (15), `.claude/commands/setup.md` (3), `.claude/commands/add-template.md` (2), `.claude/skills/job-application-assistant/SKILL.md` (3), `.claude/skills/job-application-assistant/05-cv-templates.md` (2), `.claude/skills/job-application-assistant/06-cover-letter-templates.md` (1), `.claude/skills/job-application-assistant/08-application-forms.md` (2)
- Modify: `tests/test_profile_paths.py` (`CONVERTED_FILES`)

**Interfaces:**
- Consumes: naming from Task 6.
- Produces: `/setup` and `/reset` operating inside one profile; the assistant skill routing personalized reads to `profiles/<name>/skills/`.

- [ ] **Step 1: Register the eight files in the audit test**

Append to `CONVERTED_FILES`:

```python
    ".claude/commands/expand.md",
    ".claude/commands/reset.md",
    ".claude/commands/setup.md",
    ".claude/commands/add-template.md",
    ".claude/skills/job-application-assistant/SKILL.md",
    ".claude/skills/job-application-assistant/05-cv-templates.md",
    ".claude/skills/job-application-assistant/06-cover-letter-templates.md",
    ".claude/skills/job-application-assistant/08-application-forms.md",
```

- [ ] **Step 2: Run the audit to see it fail**

Run: `python -m unittest tests.test_profile_paths -v`
Expected: FAIL, listing ~28 hits (the `cv/main_example.tex` mentions in `setup.md`, `05-cv-templates.md`, and `08-application-forms.md` are allowed and must NOT appear)

- [ ] **Step 3: Convert the paths**

| Before | After |
|---|---|
| `documents/cv`, `documents/linkedin`, `documents/diplomas`, `documents/references`, `documents/applications` | `profiles/<name>/documents/<same>` |
| `cv/main_<company>_<role>.tex` | `profiles/<name>/cv/main_<company>_<role>.tex` |
| `cover_letters/cover_<company>_<role>.tex` | `profiles/<name>/cover_letters/cover_<company>_<role>.tex` |
| `cv/main_<company>_<role><source ext>` (add-template) | `profiles/<name>/cv/main_<company>_<role><source ext>` |
| `cover_letters/cover_<company>_<role><source ext>` (add-template) | `profiles/<name>/cover_letters/cover_<company>_<role><source ext>` |
| `job_scraper/seen_jobs.json` | `profiles/<name>/job_scraper/seen_jobs.json` |

Insert the **Profile:** block from Task 5 Step 3 into `expand.md`, `reset.md`, `setup.md`, and
`add-template.md` Step 0.

In `.claude/commands/setup.md`, additionally:
- State that `/setup` writes the five personalized files into `profiles/<name>/skills/`, never into
  the repo-root masters under `.claude/skills/`.
- State that it writes the identity block to `profiles/<name>/PROFILE.md`, and that root `CLAUDE.md`
  holds no candidate data.

In `.claude/commands/reset.md`, additionally:
- Scope every deletion to the resolved profile, and add an explicit line that `/reset` never touches
  another profile's directory.
- Require the resolved profile name to be echoed in the confirmation prompt before any deletion.

In `.claude/skills/job-application-assistant/SKILL.md`, route reads of the personalized files to
`profiles/<name>/skills/01-candidate-profile.md`, `…/02-behavioral-profile.md`,
`…/03-writing-style.md`, `…/04-job-evaluation.md`, and add the **Profile:** block after the opening
paragraph. Files `05`, `06`, `07`, `08`, `09` stay shared and are still read from `.claude/skills/`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m unittest tests.test_profile_paths tests.test_upskill_skill -v`
Expected: PASS

- [ ] **Step 5: Run lint**

Run: `python tools/lint_skills.py`
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add .claude/commands/expand.md .claude/commands/reset.md .claude/commands/setup.md .claude/commands/add-template.md .claude/skills/job-application-assistant/ tests/
git commit -m "refactor(profiles): scope setup, reset, and expand per profile

/setup now fills the active profile's skill files instead of the shared
masters, and /reset can no longer delete the other candidate's data."
```

---

### Task 9: LaTeX compilation from profile directories

Riskiest change in the plan: generated documents move into `profiles/<name>/`, while `cover.cls` and the fonts stay at the repo root. Validated by a real compile, not by inspection.

**Files:**
- Modify: `.claude/skills/job-application-assistant/05-cv-templates.md`
- Modify: `.claude/skills/job-application-assistant/06-cover-letter-templates.md`
- Modify: `.claude/commands/apply.md` (compile-command steps)
- Modify: `CLAUDE.md` (compiled-PDF verification checklist commands)

**Interfaces:**
- Consumes: generated-document paths from Task 6.
- Produces: the two canonical compile invocations quoted below, used by `/apply` and the verification checklist.

- [ ] **Step 1: Prove the new invocation compiles, before writing it into any spec**

```bash
mkdir -p /tmp/profile-compile-probe/cv /tmp/profile-compile-probe/cover_letters
cp cv/main_example.tex /tmp/profile-compile-probe/cv/main_probe_role.tex
cp cover_letters/cover_example.tex /tmp/profile-compile-probe/cover_letters/cover_probe_role.tex
mkdir -p profiles/_probe && cp -r /tmp/profile-compile-probe/* profiles/_probe/

lualatex -interaction=nonstopmode -output-directory=profiles/_probe/cv \
         profiles/_probe/cv/main_probe_role.tex

TEXINPUTS=./cover_letters: xelatex -interaction=nonstopmode \
         -output-directory=profiles/_probe/cover_letters \
         profiles/_probe/cover_letters/cover_probe_role.tex
```

Expected: both produce a PDF. The cover letter will fail on the font path until Step 2 — that failure is the signal, not a surprise.

- [ ] **Step 2: Fix the font path and re-run**

In `profiles/_probe/cover_letters/cover_probe_role.tex`, change every
`\fontspec[Path = OpenFonts/fonts/` to `\fontspec[Path = cover_letters/OpenFonts/fonts/` (paths now
resolve from the repo-root working directory), then re-run the `xelatex` command from Step 1.

Expected: PDF produced, 1 page, fonts embedded. Verify with:

```bash
python tools/verify_pdf.py profiles/_probe/cover_letters/cover_probe_role.pdf
pdffonts profiles/_probe/cover_letters/cover_probe_role.pdf | head
```

**If this cannot be made to work:** fall back to the documented alternative — copy `cover.cls` and
`OpenFonts/` into `profiles/<name>/cover_letters/` during `/profile new`, compile from inside that
directory, and keep the upstream `Path = OpenFonts/fonts/…` strings. Record which route was taken in
the commit message.

- [ ] **Step 3: Write the verified invocations into the specs**

In `06-cover-letter-templates.md`, replace the compile instructions with:

```bash
TEXINPUTS=./cover_letters: xelatex -interaction=nonstopmode \
    -output-directory=profiles/<name>/cover_letters \
    profiles/<name>/cover_letters/cover_<company>_<role>.tex
```

and state that generated letters use `\fontspec[Path = cover_letters/OpenFonts/fonts/raleway/]`,
because compiles run from the repo root.

In `05-cv-templates.md`, replace the compile instructions with:

```bash
lualatex -interaction=nonstopmode -output-directory=profiles/<name>/cv \
    profiles/<name>/cv/main_<company>_<role>.tex
```

Update the same two commands wherever `apply.md` and root `CLAUDE.md`'s "Compiled PDF verification"
checklist quote them.

- [ ] **Step 4: Clean up the probe**

```bash
rm -rf profiles/_probe /tmp/profile-compile-probe
```

- [ ] **Step 5: Run tests and confirm nothing regressed**

Run: `python -m unittest tests.test_profile_paths tests.test_verify_pdf -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/job-application-assistant/05-cv-templates.md .claude/skills/job-application-assistant/06-cover-letter-templates.md .claude/commands/apply.md CLAUDE.md
git commit -m "build(latex): compile profile documents from the repo root

Generated CVs and letters live under profiles/<name>/ while cover.cls and
the bundled fonts stay shared, so compiles run from the root with
TEXINPUTS and -output-directory. Verified by a real compile of both."
```

---

### Task 10: Rewrite root `CLAUDE.md`

`CLAUDE.md` is auto-loaded at a fixed path, so any candidate data in it would be present in every session regardless of the active profile.

**Files:**
- Modify: `CLAUDE.md`
- Test: `tests/test_claude_md_profile_neutral.py`

**Interfaces:**
- Consumes: `.claude/PROFILES.md` (Task 1), `/profile` (Task 2).
- Produces: a candidate-neutral `CLAUDE.md`.

- [ ] **Step 1: Write the failing test**

Create `tests/test_claude_md_profile_neutral.py`:

```python
"""Root CLAUDE.md must hold no candidate data.

It is auto-loaded at a fixed path, so an identity block or an @-import of one
profile would pin that candidate into every session - including sessions
working on the other candidate's application.
"""
import re
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
CLAUDE_MD = REPO / "CLAUDE.md"

CANDIDATE_SECTION_HEADINGS = [
    "## Candidate Profile",
    "### Identity",
    "### Behavioral Profile",
    "### Professional Experience",
]


class ClaudeMdIsProfileNeutral(unittest.TestCase):
    def setUp(self):
        self.text = CLAUDE_MD.read_text(encoding="utf-8")

    def test_no_candidate_sections(self):
        for heading in CANDIDATE_SECTION_HEADINGS:
            self.assertNotIn(heading, self.text, f"candidate data leaked into CLAUDE.md: {heading}")

    def test_no_profile_import(self):
        self.assertIsNone(
            re.search(r"@profiles/", self.text),
            "CLAUDE.md must not @-import a profile; the path is fixed and would pin one candidate",
        )

    def test_points_at_the_resolution_contract(self):
        self.assertIn(".claude/PROFILES.md", self.text)

    def test_documents_the_profile_command(self):
        self.assertIn("/profile", self.text)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests.test_claude_md_profile_neutral -v`
Expected: FAIL — `candidate data leaked into CLAUDE.md: ## Candidate Profile`

- [ ] **Step 3: Rewrite `CLAUDE.md`**

Delete the entire `## Candidate Profile` block (Identity through Deal-breakers). Replace it with:

```markdown
## Candidate Profiles

This repo serves two candidates with separate job searches. No candidate data lives in this file:
it is auto-loaded at a fixed path, so anything here would be present in every session, including
sessions working on the other candidate's application.

- Resolution rules and the full path table: `.claude/PROFILES.md`
- Switch or inspect: `/profile`, `/profile use <name>`, `/profile status`
- Candidate data: `profiles/<name>/PROFILE.md` and `profiles/<name>/skills/`

Before doing anything with candidate data, resolve the profile per `.claude/PROFILES.md` and state
`Profile: <name>` in the first line of output.
```

Update the `## Repo Structure` section to list `profiles/` and `.claude/PROFILES.md`. Update the
`## Workflow for New Job Applications` steps to name `profiles/<name>/cv/main_<company>_<role>.tex`
and `profiles/<name>/cover_letters/cover_<company>_<role>.tex`. Leave the Verification Checklist
intact apart from the compile commands already updated in Task 9.

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m unittest tests.test_claude_md_profile_neutral tests.test_profile_paths -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md tests/test_claude_md_profile_neutral.py
git commit -m "refactor(profiles): make root CLAUDE.md candidate-neutral

CLAUDE.md is auto-loaded at a fixed path, so an identity block there would
pin one candidate into every session regardless of the active profile."
```

---

### Task 11: Completeness gate and full verification

**Files:**
- Modify: `tests/test_profile_paths.py` (add the completeness assertion)

**Interfaces:**
- Consumes: `CONVERTED_FILES` as accumulated by Tasks 5–8.
- Produces: the pinned final file set, so a future edit that reintroduces a root path fails.

- [ ] **Step 1: Add the completeness test**

Append to `tests/test_profile_paths.py`, inside `ConvertedFilesUseProfilePaths`:

```python
    def test_every_profile_scoped_spec_is_converted(self):
        expected = {
            ".claude/commands/add-template.md",
            ".claude/commands/apply.md",
            ".claude/commands/expand.md",
            ".claude/commands/gmail-sync.md",
            ".claude/commands/html-report.md",
            ".claude/commands/interview.md",
            ".claude/commands/notion-sync.md",
            ".claude/commands/outcome.md",
            ".claude/commands/rank.md",
            ".claude/commands/reset.md",
            ".claude/commands/setup.md",
            ".claude/skills/job-application-assistant/05-cv-templates.md",
            ".claude/skills/job-application-assistant/06-cover-letter-templates.md",
            ".claude/skills/job-application-assistant/08-application-forms.md",
            ".claude/skills/job-application-assistant/SKILL.md",
            ".claude/skills/job-scraper/SKILL.md",
            ".claude/skills/upskill/SKILL.md",
        }
        self.assertEqual(set(CONVERTED_FILES), expected)

    def test_unregistered_specs_have_no_candidate_paths(self):
        """Catches a new or missed spec that quietly uses a root path."""
        registered = set(CONVERTED_FILES)
        hits = []
        for path in sorted((REPO / ".claude").rglob("*.md")):
            rel = str(path.relative_to(REPO))
            if rel in registered:
                continue
            hits.extend(offending_lines(rel))
        self.assertEqual(hits, [], "unregistered spec uses root candidate paths:\n" + "\n".join(hits))
```

- [ ] **Step 2: Run it**

Run: `python -m unittest tests.test_profile_paths -v`
Expected: PASS. If `test_unregistered_specs_have_no_candidate_paths` fails, convert the named file
per the Task 5 substitution table and add it to both `CONVERTED_FILES` and `expected`.

- [ ] **Step 3: Run the whole suite, lint, and guards**

```bash
python -m unittest discover -s tests -t . -v
python tools/lint_skills.py
python tools/security_guards.py
```

Expected: all three exit 0. Fix any failure here rather than deferring it.

- [ ] **Step 4: Commit**

```bash
git add tests/test_profile_paths.py
git commit -m "test(profiles): pin the converted spec set

An unregistered spec using a root candidate path is the silent failure
mode; this gate makes it a red test instead."
```

---

### Task 12: Scaffold both profiles and smoke-test end to end

**Files:**
- Create (untracked): `profiles/abhinav/**`, `profiles/anushka/**`, `.active-profile`

**Interfaces:**
- Consumes: `/profile` (Task 2), ignore rules (Task 3).
- Produces: a working two-profile installation.

- [ ] **Step 1: Scaffold both profiles**

Run `/profile new abhinav`, then `/profile new anushka`, following `.claude/commands/profile.md`
Step 3 exactly.

- [ ] **Step 2: Verify the skeletons**

```bash
find profiles -maxdepth 3 | sort
```

Expected: both profiles show `PROFILE.md`, `tracker.csv`, `skills/` with all five files, `cv/`,
`cover_letters/`, `documents/` with all seven subdirectories, and `job_scraper/`.

- [ ] **Step 3: Leak test**

```bash
printf '2026-08-08,Acme,Tech,Engineer,full_time,linkedin,drafted,,,,,,\n' >> profiles/abhinav/tracker.csv
touch profiles/abhinav/cv/main_acme_engineer.tex
git status --porcelain
python tools/security_guards.py
```

Expected: `git status --porcelain` prints nothing, guards exit 0. If anything appears, the ignore
rules from Task 3 are wrong — fix them before continuing.

- [ ] **Step 4: Switch test**

```bash
echo "--- expect abhinav ---" && cat .active-profile
```

Run `/profile use anushka`, then:

```bash
cat .active-profile
wc -l profiles/abhinav/tracker.csv profiles/anushka/tracker.csv
```

Expected: `.active-profile` contains `anushka`; Abhinav's tracker still holds the Acme row and
Anushka's holds only its header. Run `/profile use abhinav` and confirm the row is visible again.

- [ ] **Step 5: Unknown-profile test**

Run `/profile use nobody`.
Expected: refusal listing `abhinav` and `anushka`, `.active-profile` unchanged, nothing created.

- [ ] **Step 6: No-profile test**

```bash
mv .active-profile /tmp/active-profile.bak
```

Run `/profile` with no argument.
Expected: it lists `abhinav` and `anushka`, tells the user to run `/profile use <name>`, and reads
or writes nothing else. Then restore:

```bash
mv /tmp/active-profile.bak .active-profile
```

- [ ] **Step 7: Merged view test**

Add a row to `profiles/anushka/tracker.csv` with status `applied`, then run `/profile status`.
Expected: both rows in one table, each labelled with its profile, with open/final counts per profile.

- [ ] **Step 8: Clean up smoke data**

```bash
rm -f profiles/abhinav/cv/main_acme_engineer.tex
```

Remove the two fake tracker rows, leaving each `tracker.csv` with its header only.

- [ ] **Step 9: Commit**

Nothing under `profiles/` is committable by design, so this task commits only documentation of the
installed state:

```bash
git status --porcelain   # must be empty
git log --oneline -12    # confirm the task-by-task history
```

If `git status` is empty, there is nothing to commit — say so explicitly rather than forcing a
commit.

---

## Post-implementation

Both candidates then run, one at a time:

```
/profile use abhinav
/setup
```

`/setup` fills `profiles/abhinav/PROFILE.md` and the five files in `profiles/abhinav/skills/`.
Repeat with `/profile use anushka`.

Write to `tasks/lessons.md`: whether the LaTeX `TEXINPUTS` route in Task 9 held or the per-profile
asset-copy fallback was needed, since that is the one decision here that empirical evidence could
overturn.
