#!/bin/bash
# Renders icon.svg to the PNG sizes phones ask for, with Edge in headless mode.
cd "$(dirname "$0")"
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
U=$(cygpath -m "$PWD"); W=$(cygpath -w "$PWD")
shot() { local T; T=$(cygpath -w "$(mktemp -d)"); "$EDGE" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --user-data-dir="$T" --allow-file-access-from-files --virtual-time-budget=2000 --window-size=$1,$1 --screenshot="$(cygpath -w "$PWD/$2")" "file:///$U/render.html$3" > /dev/null 2>&1; }
shot 512 icon-512.png
shot 512 maskable-512.png '?m'
# Edge won't open a window under about 500 px, so the small sizes are scaled down from the 512 one
for s in 192:icon-192.png 180:apple-touch-icon.png; do
  MSYS_NO_PATHCONV=1 docker run --rm --memory=300m -v "$W:/i" -w /i vsk:1 ffmpeg -v error -y -i icon-512.png -vf scale=${s%%:*}:-1:flags=lanczos ${s#*:} < /dev/null
done
ls -la *.png
