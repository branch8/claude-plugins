#!/usr/bin/env bash
# CwdChanged (/cd) and DirectoryAdded (/add-dir) hook: tell the user at once
# which Jira project the new folder is recorded for. Only a systemMessage -
# Claude itself sees the working-directory change and follows the Folders
# rules from the SessionStart context.

[ "$BRANCH8_JIRA_CHECK" = off ] && exit 0

. "$(dirname "$0")/lib.sh"

input=$(cat)
dir=$(b8_jget "$input" new_cwd)
[ -n "$dir" ] || dir=$(b8_jget "$input" directory)
[ -n "$dir" ] || exit 0
# JSON-escaped backslashes in Windows paths
dir=$(printf '%s' "$dir" | sed 's/\\\\/\\/g')

shown=$(b8_native "$dir")
case "$(b8_lang "$dir")" in
  zh-TW) L_nomap="尚未對應 Jira 專案"; L_ask="尚未對應 Jira 專案，需要時會問一次" ;;
  zh-CN) L_nomap="尚未对应 Jira 项目"; L_ask="尚未对应 Jira 项目，需要时会问一次" ;;
  *)     L_nomap="no Jira project recorded"; L_ask="no Jira project recorded yet; you will be asked once when needed" ;;
esac
if found=$(b8_lookup "$dir"); then
  rec=$(cat "${found#*$'\t'}")
  key=$(b8_jget "$rec" projectKey)
  name=$(b8_jget "$rec" projectName)
  if [ -n "$key" ]; then
    msg="📁 $shown → Jira $key${name:+（$name）}"
  elif printf '%s' "$rec" | grep -q '"jira": *"none"\|"company": *false'; then
    exit 0
  else
    msg="📁 $shown → $L_nomap"
  fi
else
  msg="📁 $shown → $L_ask"
fi

printf '{"systemMessage":"%s"}\n' "$(printf '%s' "$msg" | b8_jesc)"
