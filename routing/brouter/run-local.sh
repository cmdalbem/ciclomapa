#!/usr/bin/env bash
# Local BRouter (Java). Docker Desktop is locked on this Mac profile.
set -euo pipefail
cd "$(dirname "$0")"

JAR=brouter-all.jar
ZIP_URL=https://github.com/abrensch/brouter/releases/download/v1.7.10/brouter-1.7.10.zip
PORT="${BROUTER_PORT:-17777}"

# 5x5° tiles (SW corner in the name). Keep whatever cities you need side by side.
TILES=(
  "W50_S25" # São Paulo
  "E0_N40"  # Barcelona / NE Spain
)

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
for tile in "${TILES[@]}"; do
  path="segments4/${tile}.rd5"
  if [[ ! -f "$path" ]]; then
    echo "Downloading BRouter tile ${tile}.rd5 ..."
    curl -L --retry 3 -o "$path" "https://brouter.de/brouter/segments4/${tile}.rd5"
  fi
done

mkdir -p customprofiles

# BRouter only opens RoutingEngine's debug log when the profile path has a
# parent-of-parent folder (HTTP usually passes a bare name, so nothing is written).
# Nested profile + symlink: local proxy rewrites profile=ciclomapa → _debug/p/ciclomapa
# so logs land in _debug/debug.txt and still load profiles2/ciclomapa.brf.
mkdir -p profiles2/_debug/p _debug
ln -sfn ../../ciclomapa.brf profiles2/_debug/p/ciclomapa.brf
: > _debug/debug.txt

echo "Starting BRouter on :$PORT (tiles: ${TILES[*]}) ..."
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
java -Xmx1g -Xms256m \
  -DmaxRunningTime=120 \
  -DdebugThreadPool=true \
  -cp "$JAR" btools.server.RouteServer \
  segments4 profiles2 customprofiles "$PORT" 2 127.0.0.1
