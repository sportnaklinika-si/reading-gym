#!/bin/bash
# The colour looks Jan is choosing from (A Washi, B Jutro, C Tihota, D Žad, N neutral placeholder): Today and the month view of Napredek,
# each 390 x 844, as test/theme-<X>-today.png and test/theme-<X>-stats.png. Needs internet for the Google Fonts of A to D.
cd "$(dirname "$0")"
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
U=$(cygpath -m "$PWD"); W=$(cygpath -w "$PWD")
shot() { local T; T=$(cygpath -w "$(mktemp -d)"); "$EDGE" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --user-data-dir="$T" --allow-file-access-from-files --virtual-time-budget=7000 --window-size=500,900 --screenshot="$(cygpath -w "$PWD/_raw.png")" "file:///$U/frame.html?$1" > /dev/null 2>&1
  MSYS_NO_PATHCONV=1 docker run --rm --memory=300m -v "$W:/t" vsk:1 ffmpeg -v error -y -i /t/_raw.png -vf crop=390:844:0:0 "/t/$2" < /dev/null; rm -f _raw.png; }
for X in A B C D N; do
  shot "demo&theme=$X" "theme-$X-today.png"
  shot "demo-month&theme=$X" "theme-$X-stats.png"
done
ls -la theme-*.png
