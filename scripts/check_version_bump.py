#!/usr/bin/env python3
"""Fail a PR that changes plugin content without bumping that plugin's version.

Organization auto-sync only runs when a merged pull request contains a plugin
version bump. A content change with no bump merges silently and never reaches
anyone - this is the single most common way a rollout goes missing.

Usage:
    python3 scripts/check_version_bump.py <base-sha>          # report, exit 1 on miss
    python3 scripts/check_version_bump.py <base-sha> --fix    # bump the patch instead
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def git(*args: str) -> str:
    result = subprocess.run(
        ["git", *args], cwd=REPO_ROOT, capture_output=True, text=True, check=False
    )
    return result.stdout.strip() if result.returncode == 0 else ""


def plugin_roots() -> dict[str, Path]:
    data = json.loads((REPO_ROOT / ".claude-plugin" / "marketplace.json").read_text())
    roots = {}
    for entry in data.get("plugins", []):
        source = entry.get("source")
        if isinstance(source, str) and source.startswith("./"):
            roots[entry["name"]] = Path(source[2:])
    return roots


def version_at(ref: str, plugin_dir: Path) -> str | None:
    for candidate in (
        plugin_dir / ".claude-plugin" / "plugin.json",
        plugin_dir / "plugin.json",
    ):
        blob = git("show", f"{ref}:{candidate.as_posix()}")
        if blob:
            try:
                return str(json.loads(blob).get("version"))
            except json.JSONDecodeError:
                return None
    return None


def manifest_path(plugin_dir: Path) -> Path | None:
    for candidate in (
        REPO_ROOT / plugin_dir / ".claude-plugin" / "plugin.json",
        REPO_ROOT / plugin_dir / "plugin.json",
    ):
        if candidate.exists():
            return candidate
    return None


def bump(plugin_dir: Path, current: str) -> str:
    """Increment the patch component and write it back."""
    path = manifest_path(plugin_dir)
    if not path:
        raise SystemExit(f"{plugin_dir}: no plugin.json to bump")
    match = re.match(r"^(\d+)\.(\d+)\.(\d+)", current or "")
    major, minor, patch = (int(g) for g in match.groups()) if match else (0, 0, 0)
    new = f"{major}.{minor}.{patch + 1}"
    data = json.loads(path.read_text())
    data["version"] = new
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    return new


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    fix = "--fix" in sys.argv
    if not args:
        print("usage: check_version_bump.py <base-sha> [--fix]")
        return 2

    base = args[0]
    changed = git("diff", "--name-only", base, "HEAD").splitlines()
    if not changed:
        print("no changes")
        return 0

    failures = []
    for name, plugin_dir in plugin_roots().items():
        prefix = plugin_dir.as_posix() + "/"
        touched = [f for f in changed if f.startswith(prefix)]
        if not touched:
            continue

        # VENDORED.md alone means only provenance metadata moved.
        if all(f.endswith("VENDORED.md") for f in touched):
            continue

        old = version_at(base, plugin_dir)
        new = version_at("HEAD", plugin_dir)
        if old is None:
            print(f"{name}: new plugin at version {new}")
            continue
        if old == new:
            if fix:
                bumped = bump(plugin_dir, old)
                print(f"{name}: {old} -> {bumped} (auto-bumped)")
            else:
                failures.append(
                    f"{name}: {len(touched)} file(s) changed but version is still {old}. "
                    f"Bump it in {plugin_dir}/.claude-plugin/plugin.json."
                )
        else:
            print(f"{name}: {old} -> {new}")

    for msg in failures:
        print(f"ERROR {msg}")
    if failures:
        print("\nWithout a version bump this merge will not trigger an org sync.")
        return 1

    print("OK - all changed plugins have a version bump")
    return 0


if __name__ == "__main__":
    sys.exit(main())
