#!/usr/bin/env python3
"""Report official plugins whose pinned commit moved since we last checked them.

Some of our skills call official plugins (superpowers, mattpocock-skills) and
override parts of their behaviour at run time. Those plugins update without a
review on our side (CLAUDE.md decision 3), so a change upstream can quietly
break a flow. This compares the official marketplace's pins with the ones in
upstream-watch.json and prints each change as a JSON line; the workflow opens
an issue for it. After re-checking, a maintainer updates upstream-watch.json.

Usage: upstream_watch.py [--watch upstream-watch.json] [--marketplace FILE_OR_URL]
"""
import argparse
import json
import sys
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def pinned_sha(marketplace: dict, name: str) -> str | None:
    """The commit the marketplace pins plugin `name` to; None for in-repo or missing plugins."""
    for plugin in marketplace.get("plugins", []):
        if plugin.get("name") == name:
            source = plugin.get("source")
            return source.get("sha") if isinstance(source, dict) else None
    return None


def changes(watch: dict, marketplace: dict) -> list[dict]:
    """Watched plugins whose pin differs from the one we checked (new is None when dropped)."""
    out = []
    for name, seen in watch.get("plugins", {}).items():
        new = pinned_sha(marketplace, name)
        if new != seen.get("sha"):
            out.append({"name": name, "old": seen.get("sha"), "new": new,
                        "version": seen.get("version"), "recheck": seen.get("recheck")})
    return out


def issue_title(change: dict) -> str:
    short = lambda sha: (sha or "none")[:7]
    return f"Upstream update: {change['name']} {short(change['old'])} -> {short(change['new'])}"


def issue_body(change: dict) -> str:
    new = change["new"] or "(removed from the official marketplace)"
    return (
        f"The official marketplace now pins `{change['name']}` to `{new}`.\n"
        f"We last checked it at `{change['old']}` (version {change['version']}).\n\n"
        "Colleagues already receive the new version automatically. Our skills override parts of "
        "its behaviour, and the eval sandbox does not load it, so only a manual check shows "
        "whether the flow still holds.\n\n"
        f"**Re-check:** {change['recheck']}\n\n"
        f"**When it holds:** update the sha (and version) in `upstream-watch.json` in a PR, "
        "then close this issue. If it breaks, fix the skill text first."
    )


def load(path_or_url: str) -> dict:
    if path_or_url.startswith("https://"):
        with urllib.request.urlopen(path_or_url, timeout=30) as resp:
            return json.load(resp)
    return json.loads(Path(path_or_url).read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--watch", default=str(REPO_ROOT / "upstream-watch.json"))
    parser.add_argument("--marketplace", help="file or https URL; default: the URL in the watch file")
    args = parser.parse_args()

    watch = load(args.watch)
    marketplace = load(args.marketplace or watch["marketplace"])
    for change in changes(watch, marketplace):
        print(json.dumps({**change, "title": issue_title(change), "body": issue_body(change)}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
