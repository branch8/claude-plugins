#!/usr/bin/env python3
"""Detect upstream changes, re-vendor, bump versions, and write a PR body.

This is what the vendor-update workflow runs. It does everything except open the
pull request itself, so it can also be run locally to preview what the bot would do.

Usage:
    python3 scripts/auto_update.py --dry-run    # report only, touch nothing
    python3 scripts/auto_update.py              # apply changes, write .pr-body.md
    python3 scripts/auto_update.py --only superpowers
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import vendor  # noqa: E402  (same directory)

REPO_ROOT = Path(__file__).resolve().parent.parent
LOCK_FILE = REPO_ROOT / "vendor.lock.json"
VENDOR_DIR = REPO_ROOT / "vendor"
PR_BODY = REPO_ROOT / ".pr-body.md"

# Files worth a second look in review: anything that can execute, plus hook and
# permission config. A skill that quietly grew a shell script is the thing you
# actually want to catch.
RISKY_SUFFIXES = (".sh", ".bash", ".zsh", ".py", ".js", ".ts", ".rb", ".ps1")
RISKY_NAMES = ("hooks.json", ".mcp.json", "settings.json", "Makefile", "install")


def git(*args: str) -> str:
    result = subprocess.run(
        ["git", *args], cwd=REPO_ROOT, capture_output=True, text=True, check=False
    )
    return result.stdout.strip() if result.returncode == 0 else ""


def upstream_head(repo: str) -> str:
    out = vendor.run(["git", "ls-remote", repo, "HEAD"])
    if not out:
        raise SystemExit(f"could not reach {repo}")
    return out.split()[0]


def manifest_path(plugin_dir: Path) -> Path | None:
    for candidate in (
        plugin_dir / ".claude-plugin" / "plugin.json",
        plugin_dir / "plugin.json",
    ):
        if candidate.exists():
            return candidate
    return None


def read_version(plugin_dir: Path) -> str | None:
    path = manifest_path(plugin_dir)
    if not path:
        return None
    try:
        return str(json.loads(path.read_text()).get("version", ""))
    except json.JSONDecodeError:
        return None


def parts(version: str) -> tuple[int, int, int]:
    match = re.match(r"^(\d+)\.(\d+)\.(\d+)", version or "")
    return tuple(int(g) for g in match.groups()) if match else (0, 0, 0)


def bump_patch(version: str) -> str:
    major, minor, patch = parts(version)
    return f"{major}.{minor}.{patch + 1}"


def set_version(plugin_dir: Path, version: str) -> None:
    path = manifest_path(plugin_dir)
    if not path:
        raise SystemExit(f"{plugin_dir.name}: no plugin.json to version")
    data = json.loads(path.read_text())
    data["version"] = version
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def risky_files(changed: list[str]) -> list[str]:
    out = []
    for f in changed:
        name = Path(f).name
        if f.endswith(RISKY_SUFFIXES) or name in RISKY_NAMES:
            out.append(f)
    return out


def compare_url(repo: str, old: str, new: str) -> str:
    return f"{repo.removesuffix('.git')}/compare/{old}...{new}"


def update_one(source: dict, dry_run: bool) -> dict | None:
    dest = source["dest"]
    old_ref = source["ref"]
    new_ref = upstream_head(source["repo"])

    if new_ref == old_ref:
        print(f"    {dest}: up to date ({new_ref[:12]})")
        return None

    print(f"    {dest}: {old_ref[:12]} -> {new_ref[:12]}")
    if dry_run:
        return {"dest": dest, "old_ref": old_ref, "new_ref": new_ref, "dry": True}

    plugin_dir = VENDOR_DIR / dest
    old_version = read_version(plugin_dir) or "0.0.0"

    source["ref"] = new_ref
    vendor.vendor_one(source)

    # Upstream's own version wins if it moved forward. If upstream changed content
    # without bumping, we bump the patch ourselves - otherwise the org sync never
    # fires and this whole PR ships nothing.
    upstream_version = read_version(plugin_dir) or "0.0.0"
    if parts(upstream_version) > parts(old_version):
        new_version = upstream_version
        version_note = "follows upstream"
    else:
        new_version = bump_patch(old_version)
        version_note = "local bump (upstream did not version this change)"
    set_version(plugin_dir, new_version)

    # Intent-to-add first: a brand new file from upstream is untracked, and untracked
    # files do not appear in `git diff`. Without this, a freshly added install.sh -
    # exactly the thing worth flagging - would be invisible in the PR summary.
    git("add", "-N", "--", f"vendor/{dest}")

    changed = [
        line for line in git("diff", "--name-only", "--", f"vendor/{dest}").splitlines()
    ]
    stat = git("diff", "--stat", "--", f"vendor/{dest}").splitlines()

    return {
        "dest": dest,
        "repo": source["repo"],
        "old_ref": old_ref,
        "new_ref": new_ref,
        "old_version": old_version,
        "new_version": new_version,
        "version_note": version_note,
        "compare": compare_url(source["repo"], old_ref, new_ref),
        "changed": changed,
        "risky": risky_files(changed),
        "stat": stat[-1].strip() if stat else "no file changes",
    }


def write_pr_body(updates: list[dict]) -> None:
    lines = [
        "Automated vendoring update. Review the upstream diffs below, then merge.",
        "",
        "**Merging this ships the changes to everyone in the organization.**",
        "",
    ]

    any_risky = any(u["risky"] for u in updates)
    if any_risky:
        lines += [
            "> [!WARNING]",
            "> This update touches executable or hook files. Read those diffs line by line.",
            "",
        ]

    for u in updates:
        lines += [
            f"## {u['dest']}",
            "",
            f"- Upstream diff: {u['compare']}",
            f"- Commit: `{u['old_ref'][:12]}` -> `{u['new_ref'][:12]}`",
            f"- Version: `{u['old_version']}` -> `{u['new_version']}` ({u['version_note']})",
            f"- Changes: {u['stat']}",
            "",
        ]
        if u["risky"]:
            lines += ["**Executable or config files in this update:**", ""]
            lines += [f"- `{f}`" for f in u["risky"]]
            lines.append("")

    lines += [
        "---",
        "",
        "### Review checklist",
        "",
        "- [ ] Read the upstream compare link, not just the vendored diff",
        "- [ ] No new scripts, hooks or MCP servers that were not there before",
        "- [ ] No new network calls or credential access",
        "- [ ] Prompt changes do not conflict with our own conventions",
        "",
        "If anything looks wrong, close this PR. The bot will reopen it next run;",
        "to skip a specific commit, pin `ref` in `vendor.lock.json` to the last good SHA.",
    ]

    PR_BODY.write_text("\n".join(lines) + "\n")
    print(f"\nPR body written to {PR_BODY.name}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="report only")
    parser.add_argument("--only", help="operate on a single dest name")
    args = parser.parse_args()

    data = json.loads(LOCK_FILE.read_text())
    sources = data["sources"]
    targets = [s for s in sources if not args.only or s["dest"] == args.only]
    if args.only and not targets:
        raise SystemExit(f"no source named '{args.only}'")

    print("Checking upstream:")
    updates = [u for s in targets if (u := update_one(s, args.dry_run))]

    if not updates:
        print("\nNothing to do.")
        return 0

    if args.dry_run:
        print(f"\n{len(updates)} plugin(s) would be updated.")
        return 0

    LOCK_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    write_pr_body(updates)
    print(f"{len(updates)} plugin(s) updated. Review `git diff` before committing.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
