#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: npm run release:tag -- <patch|minor|major|x.y.z>" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Release aborted: commit or stash local changes first." >&2
  exit 1
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "Release aborted: no git remote named origin is configured." >&2
  exit 1
fi

release_type="$1"
npm version "$release_type" -m "chore: release v%s"

branch="$(git branch --show-current)"
git push origin "$branch" --follow-tags

echo "Pushed release tag. GitHub Actions will build the DMG and publish the GitHub Release."
