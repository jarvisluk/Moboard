#!/usr/bin/env bash
set -euo pipefail

marker="$(mktemp "${TMPDIR:-/tmp}/moboard-dist-start.XXXXXX")"
cleanup() {
  rm -f "$marker"
}
trap cleanup EXIT

electron-builder --mac "$@"

if [[ -z "${APPLE_API_KEY:-}" || -z "${APPLE_API_KEY_ID:-}" || -z "${APPLE_API_ISSUER:-}" ]]; then
  echo "Skipping DMG notarization: APPLE_API_KEY, APPLE_API_KEY_ID, and APPLE_API_ISSUER are required." >&2
  exit 0
fi

shopt -s nullglob
dmg_files=()
while IFS= read -r dmg; do
  dmg_files+=("$dmg")
done < <(find dist -maxdepth 1 -type f -name '*.dmg' -newer "$marker" -print)

if (( ${#dmg_files[@]} == 0 )); then
  echo "No new DMG found; skipping DMG notarization."
  exit 0
fi

for dmg in "${dmg_files[@]}"; do
  echo "Notarizing DMG: $dmg"
  xcrun notarytool submit "$dmg" \
    --key "$APPLE_API_KEY" \
    --key-id "$APPLE_API_KEY_ID" \
    --issuer "$APPLE_API_ISSUER" \
    --wait
  xcrun stapler staple "$dmg"
  xcrun stapler validate "$dmg"
done
