#!/bin/zsh
#
# De iconen voor beginscherm-installatie (iPhone, iPad, Android). Draai met:
# npm run icons. De PNG's staan in public/icons en zitten in de repo, zodat
# een nieuwe installatie ze niet hoeft te tekenen.
set -e
cd "$(dirname "$0")/.."
mkdir -p public/icons
TMP="$(mktemp -d)"
swift scripts/maak-icoon.swift "$TMP/rond.png"
swift scripts/maak-icoon.swift "$TMP/vol.png" --vol
sips -z 192 192 "$TMP/rond.png" --out public/icons/icon-192.png >/dev/null
sips -z 512 512 "$TMP/rond.png" --out public/icons/icon-512.png >/dev/null
sips -z 180 180 "$TMP/vol.png" --out public/icons/apple-touch-icon.png >/dev/null
sips -z 512 512 "$TMP/vol.png" --out public/icons/icon-maskable-512.png >/dev/null
rm -rf "$TMP"
ls -la public/icons
