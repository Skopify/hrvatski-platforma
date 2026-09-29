#!/bin/zsh
#
# Start Hrvatski op de achtergrond en opent Safari. Wordt aangeroepen door
# Hrvatski.app (npm run app:maak), maar werkt ook los: ./scripts/app-start.sh
#
# Wat dit doet, in volgorde:
#   1. Draait er al een server op poort 3000? Dan alleen Safari openen.
#      (Nooit twee servers: die overschrijven elkaars bestanden.)
#   2. Een werkende node zoeken. Op deze Mac staat er een kapotte vooraan in het
#      PATH; zie start.command.
#   3. Ontbrekende dingen klaarzetten: pakketten, database, openstaande
#      migraties (npm run migrate maakt eerst een back-up), en een verse build als
#      de code nieuwer is dan de laatste.
#   4. De server starten in productiemodus, alleen voor dit apparaat, als
#      "beheerd": alleen dan mag hij zichzelf uitzetten.
#   5. Wachten tot hij antwoordt en dan Safari openen.
#
# Er staat niets in dit script dat iets uit data/ verwijdert.

# Wat de vorige server aan omgeving meegaf (bij "opnieuw starten") telt niet: de instellingen
# in data/instellingen.json bepalen of Telefoon & iPad aan staat.
unset HRVATSKI_LAN HRVATSKI_MANAGED

cd "$(dirname "$0")/.." || exit 1
mkdir -p data
LOG="data/app.log"
URL="http://localhost:3000"

melding() { osascript -e "display notification \"$1\" with title \"Hrvatski\"" >/dev/null 2>&1 }
open_safari() { [ -n "$HRVATSKI_GEEN_BROWSER" ] || open -a Safari "$URL" }

# 1. Draait er al iets?
if curl -s -o /dev/null --max-time 2 "$URL"; then
  open_safari
  exit 0
fi

# 2. Een node die werkt.
node_bin=""
for kandidaat in /usr/local/bin/node /opt/homebrew/bin/node "$(command -v node 2>/dev/null)"; do
  [ -x "$kandidaat" ] || continue
  if "$kandidaat" -e "0" >/dev/null 2>&1; then node_bin="$kandidaat"; break; fi
done
if [ -z "$node_bin" ]; then
  osascript -e 'display alert "Hrvatski kan niet starten" message "Er is geen werkende node gevonden. Herstellen kan met: brew upgrade node" as critical' >/dev/null 2>&1
  exit 1
fi
export PATH="$(dirname "$node_bin"):$PATH"

melding "Hrvatski start…"
{
  echo "── $(date '+%Y-%m-%d %H:%M:%S') start ── node $(node -v)"

  # 3. Klaarzetten.
  [ -d node_modules ] || npm install || exit 1
  [ -f data/hrvatski.db ] || npm run seed || exit 1
  npm run -s migrate || exit 1

  if [ ! -f .next-build/BUILD_ID ] || [ -n "$(find src content package.json next.config.ts -newer .next-build/BUILD_ID -print -quit 2>/dev/null)" ]; then
    melding "Even bijwerken, een halve minuut…"
    NODE_ENV=production node node_modules/next/dist/bin/next build || exit 1
  fi

  # Telefoon & iPad: aan als je dat in het paneel gekozen hebt. De app zelf blijft
  # op 127.0.0.1; een poortwachter (src/lib/lan-proxy.ts) laat alleen gekoppelde apparaten door.
  if [ -f data/instellingen.json ] && grep -q '"lan": *true' data/instellingen.json; then
    export HRVATSKI_LAN=1
  fi

  # 4. Starten. exec zodat het proces zelf de server is (en niet een schil eromheen).
  HRVATSKI_MANAGED=1 NODE_ENV=production exec node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3000
} >> "$LOG" 2>&1 &
disown

# 5. Wachten tot hij luistert (maximaal twee minuten, want een build kan duren).
for _ in $(seq 1 120); do
  if curl -s -o /dev/null --max-time 2 "$URL"; then
    open_safari
    exit 0
  fi
  sleep 1
done

osascript -e 'display alert "Hrvatski start niet" message "Kijk in data/app.log voor de reden." as warning' >/dev/null 2>&1
exit 1
