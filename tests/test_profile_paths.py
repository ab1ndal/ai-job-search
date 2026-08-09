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
    re.compile(r"(?<!/)upskill/report"),
    re.compile(r"(?<!/)gmail_sync/"),
    re.compile(r"(?<!/)reports/"),
]

# Root-relative reads of the five personalized skill files. These live under
# profiles/<name>/skills/ per candidate; the root path under
# .claude/skills/job-application-assistant/ (or job-scraper/ for
# search-queries.md) is the untouched MASTER that /profile new copies from.
# A runtime read of the master path uses whichever profile last ran /setup,
# not the active profile - the exact cross-contamination this class of
# pattern exists to catch. Checked separately from FORBIDDEN above so it can
# carry its own file-level exemptions (see PERSONALIZED_FILE_EXEMPTIONS).
FORBIDDEN_MASTER_FILES = [
    re.compile(
        r"\.claude/skills/job-application-assistant/"
        r"(01-candidate-profile|02-behavioral-profile|03-writing-style|04-job-evaluation)\.md"
    ),
    re.compile(r"\.claude/skills/job-scraper/search-queries\.md"),
]

# Files that legitimately name the personalized-file masters at their root
# path and must not be flagged by FORBIDDEN_MASTER_FILES - they are still
# checked against every pattern in FORBIDDEN above.
PERSONALIZED_FILE_EXEMPTIONS = {
    # Step 3 copies the five masters into a new profile's skills/ dir - it
    # must name the master paths as the copy source.
    ".claude/commands/profile.md",
}

# Shared assets that legitimately keep their root paths everywhere.
ALLOWED_SUBSTRINGS = [
    "cv/main_example.tex",
    "cover_letters/cover_example.tex",
    "cover_letters/cover.cls",
    "cover_letters/OpenFonts",
    "documents/README.md",
]

# Appended to by each conversion task.
CONVERTED_FILES: list[str] = [
    ".claude/commands/rank.md",
    ".claude/skills/job-scraper/SKILL.md",
    ".claude/skills/upskill/SKILL.md",
    ".claude/commands/apply.md",
    ".claude/commands/outcome.md",
    ".claude/commands/interview.md",
    ".claude/commands/gmail-sync.md",
    ".claude/commands/html-report.md",
    ".claude/commands/notion-sync.md",
    ".claude/commands/expand.md",
    ".claude/commands/reset.md",
    ".claude/commands/setup.md",
    ".claude/commands/add-template.md",
    ".claude/commands/add-portal.md",
    ".claude/skills/job-application-assistant/SKILL.md",
    ".claude/skills/job-application-assistant/05-cv-templates.md",
    ".claude/skills/job-application-assistant/06-cover-letter-templates.md",
    ".claude/skills/job-application-assistant/08-application-forms.md",
]


def offending_lines(rel_path: str) -> list[str]:
    path = REPO / rel_path
    hits = []
    patterns = list(FORBIDDEN)
    if rel_path not in PERSONALIZED_FILE_EXEMPTIONS:
        patterns += FORBIDDEN_MASTER_FILES
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        stripped = line
        for allowed in ALLOWED_SUBSTRINGS:
            stripped = stripped.replace(allowed, "")
        if any(pattern.search(stripped) for pattern in patterns):
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
