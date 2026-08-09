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

PERSONALIZED_SKILL_FILES = [
    "01-candidate-profile.md",
    "02-behavioral-profile.md",
    "03-writing-style.md",
    "04-job-evaluation.md",
    "search-queries.md",
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

    def test_new_names_all_five_personalized_skill_files(self):
        # A brace expansion like "0{1,2,3,4}-*.md" would still pass the scaffold-entry
        # check above without any single filename being individually findable. A profile
        # missing one of these five would fall back to placeholder text mid-application.
        section = self.text.split("/profile new", 1)[1]
        for filename in PERSONALIZED_SKILL_FILES:
            self.assertIn(filename, section, f"/profile new must name {filename} explicitly")

    def test_use_writes_only_the_pointer_file(self):
        section = self.text.split("/profile use", 1)[1]
        self.assertIn(".active-profile", section)
        self.assertIn("only file this step writes", section)

    def test_status_labels_rows_by_profile(self):
        section = self.text.split("/profile status", 1)[1]
        self.assertIn("profile", section.lower())
        self.assertIn("tracker.csv", section)


if __name__ == "__main__":
    unittest.main()
