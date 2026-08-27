#!/usr/bin/env python3
"""Validate this marketplace before it reaches Organization settings > Plugins.

A failed org sync can temporarily remove plugins for the whole team and reset
installation preferences, so this runs in CI on every pull request.

Checks:
  1. marketplace.json parses and has the required shape
  2. marketplace name is not reserved and not an Anthropic lookalike
  3. every plugin source is a relative path inside this repo
  4. every plugin has a manifest with a valid name and version
  5. plugin names are lowercase-hyphen and <= 64 chars
  6. plugin count is within the 500-per-marketplace sync limit
  7. vendored plugins match a vendor.lock.json entry
  8. no plugin ships straight out of template/

Usage: python3 scripts/validate.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MARKETPLACE = REPO_ROOT / ".claude-plugin" / "marketplace.json"
LOCK_FILE = REPO_ROOT / "vendor.lock.json"

NAME_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
SEMVER_RE = re.compile(r"^\d+\.\d+\.\d+")
MAX_PLUGINS = 500
MAX_NAME_LEN = 64

RESERVED_MARKETPLACE_NAMES = {
    "claude-code-marketplace",
    "claude-code-plugins",
    "claude-plugins-official",
    "anthropic-marketplace",
    "anthropic-plugins",
    "agent-skills",
    "life-sciences",
}

errors: list[str] = []
warnings: list[str] = []


def error(msg: str) -> None:
    errors.append(msg)


def warn(msg: str) -> None:
    warnings.append(msg)


def load_manifest(plugin_dir: Path) -> dict | None:
    for candidate in (
        plugin_dir / ".claude-plugin" / "plugin.json",
        plugin_dir / "plugin.json",
    ):
        if candidate.exists():
            try:
                return json.loads(candidate.read_text())
            except json.JSONDecodeError as exc:
                error(f"{candidate.relative_to(REPO_ROOT)}: invalid JSON - {exc}")
                return None
    return None


def check_name(name: str, label: str) -> None:
    if not NAME_RE.match(name):
        error(f"{label}: name '{name}' must be lowercase words separated by hyphens")
    if len(name) > MAX_NAME_LEN:
        error(f"{label}: name '{name}' exceeds {MAX_NAME_LEN} characters")


def main() -> int:
    if not MARKETPLACE.exists():
        error(".claude-plugin/marketplace.json is missing")
        return report()

    try:
        data = json.loads(MARKETPLACE.read_text())
    except json.JSONDecodeError as exc:
        error(f"marketplace.json: invalid JSON - {exc}")
        return report()

    market_name = data.get("name", "")
    if not market_name:
        error("marketplace.json: 'name' is required")
    else:
        check_name(market_name, "marketplace")
        if market_name in RESERVED_MARKETPLACE_NAMES:
            error(f"marketplace name '{market_name}' is reserved by Anthropic")
        if "anthropic" in market_name or "claude-plugins" in market_name:
            warn(
                f"marketplace name '{market_name}' may be rejected as an "
                "Anthropic lookalike"
            )

    plugins = data.get("plugins", [])
    if not isinstance(plugins, list) or not plugins:
        error("marketplace.json: 'plugins' must be a non-empty array")
        return report()

    if len(plugins) > MAX_PLUGINS:
        error(f"{len(plugins)} plugins exceeds the {MAX_PLUGINS} sync limit")

    lock_dests = set()
    if LOCK_FILE.exists():
        lock_dests = {s["dest"] for s in json.loads(LOCK_FILE.read_text())["sources"]}

    seen: set[str] = set()
    for entry in plugins:
        name = entry.get("name", "")
        label = f"plugin '{name or '<unnamed>'}'"

        if not name:
            error("a plugin entry has no 'name'")
            continue
        if name in seen:
            error(f"{label}: duplicate name in marketplace.json")
        seen.add(name)
        check_name(name, label)

        source = entry.get("source")
        if not isinstance(source, str):
            error(
                f"{label}: source must be a relative path string. Organization sync "
                "does accept github/url/git-subdir sources, but this repo ships "
                "first-party plugins from ./plugins/ on purpose - see 'Why they live "
                "in this repo' in README.md. Splitting one out needs lock-file "
                "support for SHA-only entries first. npm/archive/command sources are "
                "rejected by organization sync outright."
            )
            continue
        if not source.startswith("./"):
            error(f"{label}: source '{source}' must be a relative path like ./plugins/x")
            continue
        if source.startswith("./template/"):
            error(
                f"{label}: source '{source}' points into template/, which holds the "
                "starting skeleton for new plugins and must never ship. Copy it to "
                "plugins/<name>/ and rename it there instead."
            )
            continue

        plugin_dir = (REPO_ROOT / source).resolve()
        if not str(plugin_dir).startswith(str(REPO_ROOT)):
            error(f"{label}: source escapes the repository")
            continue
        if not plugin_dir.is_dir():
            error(f"{label}: directory {source} does not exist")
            continue

        if source.startswith("./vendor/"):
            dest = plugin_dir.name
            if dest not in lock_dests:
                error(
                    f"{label}: vendor/{dest} has no entry in vendor.lock.json. "
                    "Unpinned third-party code must not ship to the org."
                )
            if not (plugin_dir / "VENDORED.md").exists():
                warn(f"{label}: missing VENDORED.md - was it copied in by hand?")

        manifest = load_manifest(plugin_dir)
        if manifest is None:
            error(f"{label}: no plugin.json found in {source}")
            continue

        if manifest.get("name") != name:
            error(
                f"{label}: plugin.json name '{manifest.get('name')}' does not match "
                f"marketplace entry '{name}'. The slug is immutable once published - "
                "renaming breaks every existing install."
            )

        version = str(manifest.get("version", ""))
        if not SEMVER_RE.match(version):
            error(f"{label}: version '{version}' is not semver (x.y.z)")

        # A manifest may point components somewhere other than the conventional
        # directory - ui-ux-pro-max ships its skills under .claude/skills/, for
        # instance. Checking only the conventional names warns on a perfectly
        # valid plugin, which teaches people to ignore warnings.
        component_dirs = ["skills", "commands", "agents", "hooks"]
        for key in ("skills", "commands", "agents", "hooks"):
            declared = manifest.get(key)
            if isinstance(declared, str):
                component_dirs.append(declared)

        has_content = (
            any((plugin_dir / d).is_dir() for d in component_dirs)
            or (plugin_dir / ".mcp.json").exists()
            or isinstance(manifest.get("mcpServers"), str)
            or (plugin_dir / "SKILL.md").exists()
        )
        if not has_content:
            warn(f"{label}: no skills/, commands/, agents/, hooks/ or .mcp.json found")

    return report()


def report() -> int:
    for msg in warnings:
        print(f"WARN  {msg}")
    for msg in errors:
        print(f"ERROR {msg}")
    if errors:
        print(f"\n{len(errors)} error(s). Fix these before merging - a failed org sync")
        print("can temporarily remove plugins for your whole team.")
        return 1
    print(f"OK - marketplace valid ({len(warnings)} warning(s))")
    return 0


if __name__ == "__main__":
    sys.exit(main())
