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
