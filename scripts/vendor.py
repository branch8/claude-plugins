#!/usr/bin/env python3
"""Vendor third-party Claude plugins into vendor/ at pinned commits.

Why vendoring instead of pointing marketplace.json at github sources:
  - Organization marketplace sync only resolves relative paths reliably; external
    `github`/`url`/`git-subdir` sources are refused when the target repo is private,
    and npm/pip sources are not supported at all.
  - A pinned SHA means upstream cannot change your team's agent behaviour without a
    reviewable pull request in your own repo.

Usage:
    python3 scripts/vendor.py            # sync vendor/ to match vendor.lock.json
    python3 scripts/vendor.py --check    # report upstream commits ahead of the pin
    python3 scripts/vendor.py --only superpowers
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
LOCK_FILE = REPO_ROOT / "vendor.lock.json"
VENDOR_DIR = REPO_ROOT / "vendor"
SHA_RE = re.compile(r"^[0-9a-f]{40}$")

# Anything matching these is stripped after copying. Executables and CI config from an
# upstream repo have no business running inside your marketplace repo.
PRUNE = [".git", ".github", ".gitmodules", "node_modules", "__pycache__", ".venv"]


def run(cmd: list[str], cwd: Path | None = None) -> str:
    result = subprocess.run(
        cmd, cwd=cwd, capture_output=True, text=True, check=False
    )
    if result.returncode != 0:
        raise SystemExit(
            f"command failed: {' '.join(cmd)}\n{result.stderr.strip()}"
        )
    return result.stdout.strip()


def load_sources(only: str | None) -> list[dict]:
    data = json.loads(LOCK_FILE.read_text())
    sources = data.get("sources", [])
    if only:
        sources = [s for s in sources if s["dest"] == only]
        if not sources:
            raise SystemExit(f"no source named '{only}' in vendor.lock.json")
    return sources


def clone_at(repo: str, ref: str, workdir: Path) -> Path:
    """Fetch exactly one commit. Full clones of large skill repos are slow."""
    checkout = workdir / "src"
    checkout.mkdir()
    run(["git", "init", "--quiet"], cwd=checkout)
    run(["git", "remote", "add", "origin", repo], cwd=checkout)
    run(["git", "fetch", "--quiet", "--depth", "1", "origin", ref], cwd=checkout)
    run(["git", "checkout", "--quiet", "FETCH_HEAD"], cwd=checkout)
    return checkout


def prune(path: Path) -> None:
    for name in PRUNE:
        for target in path.rglob(name):
            if target.is_dir():
                shutil.rmtree(target, ignore_errors=True)
            elif target.exists():
                target.unlink()


def write_provenance(dest: Path, source: dict) -> None:
    (dest / "VENDORED.md").write_text(
        "# Vendored code - do not edit here\n\n"
        f"- Upstream: {source['repo']}\n"
        f"- Commit: `{source['ref']}`\n"
        f"- Subdirectory: `{source.get('subdir', '.')}`\n"
        f"- License: {source.get('license', 'unknown')}\n\n"
        "Local changes are overwritten on the next `scripts/vendor.py` run.\n"
        "To pick up upstream changes, bump `ref` in `vendor.lock.json` and re-run.\n"
    )


def vendor_one(source: dict) -> None:
    dest_name = source["dest"]
    ref = source["ref"]
    if not SHA_RE.match(ref):
        raise SystemExit(
            f"{dest_name}: ref must be a full 40-char commit SHA, got '{ref}'. "
            "Branch names are not reproducible."
        )

    dest = VENDOR_DIR / dest_name
    print(f"==> {dest_name}: fetching {source['repo']} @ {ref[:12]}")

    with tempfile.TemporaryDirectory() as tmp:
        checkout = clone_at(source["repo"], ref, Path(tmp))
        subdir = source.get("subdir", ".")
        src = (checkout / subdir).resolve()
        if not str(src).startswith(str(checkout.resolve())):
            raise SystemExit(f"{dest_name}: subdir escapes the checkout")
        if not src.is_dir():
            raise SystemExit(f"{dest_name}: subdir '{subdir}' not found upstream")

        if dest.exists():
            shutil.rmtree(dest)
        shutil.copytree(src, dest)

    prune(dest)
    write_provenance(dest, source)

    manifest = dest / ".claude-plugin" / "plugin.json"
    if not manifest.exists() and not (dest / "plugin.json").exists():
        print(
            f"    WARNING: no plugin.json found in vendor/{dest_name}. "
            "The plugin root is probably a subdirectory - set 'subdir' in vendor.lock.json."
        )
    print(f"    vendored to vendor/{dest_name}")


def check_one(source: dict) -> bool:
    """Return True if upstream default branch has moved past the pinned SHA."""
    dest_name = source["dest"]
    head = run(["git", "ls-remote", source["repo"], "HEAD"]).split()[0]
    if head == source["ref"]:
        print(f"    {dest_name}: up to date ({head[:12]})")
        return False
    print(f"    {dest_name}: pinned {source['ref'][:12]} -> upstream {head[:12]}")
    print(f"      compare: {source['repo'].removesuffix('.git')}/compare/{source['ref']}...{head}")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="report drift, change nothing")
    parser.add_argument("--only", help="operate on a single dest name")
    args = parser.parse_args()

    sources = load_sources(args.only)
    VENDOR_DIR.mkdir(exist_ok=True)

    if args.check:
        print("Checking upstream drift:")
        drifted = [s for s in sources if check_one(s)]
        return 1 if drifted else 0

    for source in sources:
        vendor_one(source)

    print("\nDone. Review `git diff vendor/` before committing - that diff is the")
    print("only thing standing between upstream and your whole team's agents.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
