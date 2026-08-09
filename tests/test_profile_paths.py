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
]


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
