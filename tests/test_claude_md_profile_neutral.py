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
