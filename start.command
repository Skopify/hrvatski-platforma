#!/bin/zsh
#
# Start het leerplatform. Dubbelklik dit bestand in Finder, of draai het vanuit
# de terminal met ./start.command
#
# Waarom dit bestand bestaat: op deze machine staat er een kapotte node vooraan
# in het PATH (Homebrew v21.6.2 linkt tegen een icu4c die er niet meer is). Een
# kale `npm run dev` valt daardoor om met een dyld-fout. Dit script zoekt zelf
# een node die het wél doet.

cd "$(dirname "$0")" || exit 1

# Zoek de eerste node die daadwerkelijk start. De volgorde is bewust: eerst de
# bekende werkende installatie, dan pas wat er in het PATH staat.
node_bin=""
for kandidaat in /usr/local/bin/node /opt/homebrew/bin/node "$(command -v node 2>/dev/null)"; do
  [ -x "$kandidaat" ] || continue
  if "$kandidaat" -e "0" >/dev/null 2>&1; then
    node_bin="$kandidaat"
    break
  fi
done

if [ -z "$node_bin" ]; then
  echo "Geen werkende node gevonden."
  echo "Herstellen kan met:  brew upgrade node"
  echo ""
  read -r "?Druk op enter om te sluiten."
  exit 1
fi

export PATH="$(dirname "$node_bin"):$PATH"
echo "node $("$node_bin" -v) — $node_bin"

if [ ! -d node_modules ]; then
  echo "Pakketten ontbreken, even installeren..."
  npm install || exit 1
fi

if [ ! -f data/hrvatski.db ]; then
  echo "Nog geen database, leerstof klaarzetten..."
  npm run seed || exit 1
fi

# De browser openen zodra de server luistert, zonder het startproces te blokkeren.
(
  for _ in $(seq 1 60); do
    if curl -s -o /dev/null http://localhost:3000; then
      open http://localhost:3000
      break
    fi
    sleep 1
  done
) &

echo ""
echo "Platform start op http://localhost:3000"
echo "Stoppen: ctrl-C, of dit venster sluiten."
echo ""

npm run dev
