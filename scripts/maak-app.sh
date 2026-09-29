#!/bin/zsh
#
# Maakt Hrvatski.app in de projectmap: een klein programma dat je in het Dock
# zet. Eén klik en het platform start, Safari opent, en als je klaar bent gaat
# alles vanzelf uit. Draai met: npm run app:maak
#
# De app zelf doet bijna niets: hij roept scripts/app-start.sh aan. Daardoor
# blijft alle logica in de repo en hoef je de app niet opnieuw te maken als het
# startscript verandert. Verplaats je de projectmap, maak de app dan opnieuw.

set -e
cd "$(dirname "$0")/.."
ROOT="$PWD"
APP="$ROOT/Hrvatski.app"
TMP="$(mktemp -d)"

rm -rf "$APP"
osacompile -o "$APP" -e "do shell script \"/bin/zsh \" & quoted form of \"$ROOT/scripts/app-start.sh\" & \" >/dev/null 2>&1 &\""

# Het icoon: getekend met een Swift-script, omgezet naar .icns.
swift scripts/maak-icoon.swift "$TMP/icoon.png"
mkdir "$TMP/Hrvatski.iconset"
for maat in 16 32 128 256 512; do
  sips -z $maat $maat "$TMP/icoon.png" --out "$TMP/Hrvatski.iconset/icon_${maat}x${maat}.png" >/dev/null
  sips -z $((maat * 2)) $((maat * 2)) "$TMP/icoon.png" --out "$TMP/Hrvatski.iconset/icon_${maat}x${maat}@2x.png" >/dev/null
done
iconutil -c icns "$TMP/Hrvatski.iconset" -o "$APP/Contents/Resources/applet.icns"

# osacompile legt een standaardicoon in Assets.car en verwijst er met CFBundleIconName
# naar; dat wint van applet.icns. Weghalen, dan telt ons eigen icoon.
rm -f "$APP/Contents/Resources/Assets.car"
plutil -remove CFBundleIconName "$APP/Contents/Info.plist" 2>/dev/null || true
plutil -replace CFBundleName -string "Hrvatski" "$APP/Contents/Info.plist"
plutil -replace CFBundleIdentifier -string "nl.hrvatski.leerplatform" "$APP/Contents/Info.plist"
# Apple Silicon start alleen programma's met een geldige handtekening; na het aanpassen opnieuw ondertekenen (lokaal, zonder account).
codesign --force --deep --sign - "$APP" >/dev/null 2>&1
touch "$APP"
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP" >/dev/null 2>&1 || true
rm -rf "$TMP"

echo "Klaar: $APP"
echo "Sleep hem naar je Dock (of naar Programma's). De eerste keer: rechtsklik → Open."
