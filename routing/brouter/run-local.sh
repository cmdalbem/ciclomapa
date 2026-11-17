#!/usr/bin/env bash
# Local BRouter (Java). Docker Desktop is locked on this Mac profile.
set -euo pipefail
cd "$(dirname "$0")"

JAR=brouter-all.jar
ZIP_URL=https://github.com/abrensch/brouter/releases/download/v1.7.10/brouter-1.7.10.zip
PORT="${BROUTER_PORT:-17777}"
# Brazil-wide routing needs more heap than a single-city PoC.
XMX="${BROUTER_XMX:-2g}"

# 5x5° tiles (SW corner in the name). PoC coverage: whole Brazil + whole Spain.
TILES=()

# Brazil bbox ~ W74..W35, S34..N5 → 9×9 grid. Ocean squares 404; we skip those.
BR_LONS=(W75 W70 W65 W60 W55 W50 W45 W40 W35)
BR_LATS=(S35 S30 S25 S20 S15 S10 S5 N0 N5)
for lon in "${BR_LONS[@]}"; do
  for lat in "${BR_LATS[@]}"; do
    TILES+=("${lon}_${lat}")
  done
done
# Spain mainland + Balearics + Canaries. Ocean squares 404; we skip those.
TILES+=(W10_N35 W10_N40 W5_N35 W5_N40 E0_N35 E0_N40 W20_N25 W15_N25)

if ! command -v java >/dev/null; then
  echo "Need Java 17+. brew install openjdk@17"
  exit 1
fi

if [[ ! -f "$JAR" ]]; then
  echo "Downloading BRouter zip ..."
  curl -L --retry 3 -o /tmp/brouter-1.7.10.zip "$ZIP_URL"
  unzip -o /tmp/brouter-1.7.10.zip "brouter-1.7.10/brouter-1.7.10-all.jar" -d /tmp/brouter-extract
  cp /tmp/brouter-extract/brouter-1.7.10/brouter-1.7.10-all.jar "$JAR"
fi

mkdir -p segments4
echo "Ensuring BRouter segment tiles (${#TILES[@]} candidates; missing ocean tiles are skipped) ..."
downloaded=0
skipped=0
for tile in "${TILES[@]}"; do
  path="segments4/${tile}.rd5"
  if [[ -f "$path" && -s "$path" ]]; then
    continue
  fi
  echo "Downloading BRouter tile ${tile}.rd5 ..."
  if curl -fL --retry 3 -o "$path" "https://brouter.de/brouter/segments4/${tile}.rd5"; then
    downloaded=$((downloaded + 1))
  else
    rm -f "$path"
    echo "  skip ${tile} (not on server)"
    skipped=$((skipped + 1))
  fi
done
echo "Tiles ready (downloaded ${downloaded}, skipped ${skipped} this run)."

mkdir -p customprofiles

# BRouter only opens RoutingEngine's debug log when the profile path has a
# parent-of-parent folder (HTTP usually passes a bare name, so nothing is written).
# Nested profile + symlink: local proxy rewrites profile=ciclomapa → _debug/p/ciclomapa
# so logs land in _debug/debug.txt and still load profiles2/ciclomapa.brf.
mkdir -p profiles2/_debug/p _debug
ln -sfn ../../ciclomapa.brf profiles2/_debug/p/ciclomapa.brf
: > _debug/debug.txt

present=(segments4/*.rd5)
echo "Starting BRouter on :$PORT (${#present[@]} .rd5 on disk, -Xmx${XMX}) ..."
echo "Verbose engine log → $(pwd)/_debug/debug.txt (mirrored below)"
echo "HTTP access lines still print on stdout as usual."
echo "----"

tail -n0 -F _debug/debug.txt &
TAIL_PID=$!
cleanup() {
  kill "$TAIL_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# debugThreadPool=true → extra contention/thread pool lines on stdout
java -Xmx"$XMX" -Xms256m \
  -DmaxRunningTime=120 \
  -DdebugThreadPool=true \
  -cp "$JAR" btools.server.RouteServer \
  segments4 profiles2 customprofiles "$PORT" 4 127.0.0.1
