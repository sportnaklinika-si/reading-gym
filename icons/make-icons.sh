#!/bin/bash
# Renders icon.svg to the PNG sizes phones ask for, with Edge in headless mode.
cd "$(dirname "$0")"
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
D=$(cygpath -w "$PWD"); TMPD=$(cygpath -w "$(mktemp -d)")
shot() { "$EDGE" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --user-data-dir="$TMPD" --window-size=$1,$1 --screenshot="$D\\$2" "file:///${D//\\//}/render.html$3" > /dev/null 2>&1; }
shot 512 icon-512.png
shot 512 maskable-512.png '?m'
# Edge won't open a window under about 500 px, so the small sizes are scaled down from the 512 one
for s in 192:icon-192.png 180:apple-touch-icon.png; do
  MSYS_NO_PATHCONV=1 docker run --rm --memory=300m -v "$D:/i" -w /i vsk:1 ffmpeg -v error -y -i icon-512.png -vf scale=${s%%:*}:-1:flags=lanczos ${s#*:} < /dev/null
done
ls -la *.png
