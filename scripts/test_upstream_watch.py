"""Tests for upstream_watch.py. Run: python3 -m unittest discover -s scripts -p 'test_*.py'"""
import unittest

import upstream_watch as uw

MARKET = {
    "plugins": [
        {"name": "superpowers", "source": {"source": "url", "url": "https://github.com/obra/superpowers.git", "sha": "new111"}},
        {"name": "mattpocock-skills", "source": {"source": "url", "url": "https://github.com/mattpocock/skills.git", "sha": "same222"}},
        {"name": "skill-creator", "source": "./plugins/skill-creator"},
    ]
}
WATCH = {
    "plugins": {
        "superpowers": {"sha": "old000", "version": "7.0.0", "recheck": "Task 6"},
        "mattpocock-skills": {"sha": "same222", "version": "1.3.1", "recheck": "Task 6"},
    }
}


class PinnedSha(unittest.TestCase):
    def test_reads_the_sha_of_an_external_source(self):
        self.assertEqual(uw.pinned_sha(MARKET, "superpowers"), "new111")

    def test_in_repo_source_has_no_sha(self):
        self.assertIsNone(uw.pinned_sha(MARKET, "skill-creator"))

    def test_missing_plugin_has_no_sha(self):
        self.assertIsNone(uw.pinned_sha(MARKET, "gone"))


class Changes(unittest.TestCase):
    def test_only_moved_pins_are_reported(self):
        self.assertEqual(
            uw.changes(WATCH, MARKET),
            [{"name": "superpowers", "old": "old000", "new": "new111", "version": "7.0.0", "recheck": "Task 6"}],
        )

    def test_a_plugin_dropped_from_the_marketplace_is_reported(self):
        market = {"plugins": [p for p in MARKET["plugins"] if p["name"] != "mattpocock-skills"]}
        names = [c["name"] for c in uw.changes(WATCH, market)]
        self.assertIn("mattpocock-skills", names)
        self.assertIsNone([c for c in uw.changes(WATCH, market) if c["name"] == "mattpocock-skills"][0]["new"])


class IssueText(unittest.TestCase):
    def test_title_names_plugin_and_short_shas(self):
        c = {"name": "superpowers", "old": "bb92a77741419a4ab5", "new": "0123456789abcdef", "version": "7.0.0", "recheck": "Task 6"}
        self.assertEqual(uw.issue_title(c), "Upstream update: superpowers bb92a77 -> 0123456")

    def test_body_says_what_to_recheck_and_how_to_close(self):
        c = {"name": "superpowers", "old": "old000", "new": "new111", "version": "7.0.0", "recheck": "Task 6"}
        body = uw.issue_body(c)
        self.assertIn("Task 6", body)
        self.assertIn("upstream-watch.json", body)
        self.assertIn("new111", body)


if __name__ == "__main__":
    unittest.main()
