#!/bin/bash
# The colour looks Jan compared (A Washi, now the app's own theme; B Jutro, C Tihota, D Žad from test/themes.js): Today and the month view
# of Napredek, each 390 x 844, as test/theme-<X>-today.png and test/theme-<X>-stats.png. B to D need internet for their Google Fonts.
cd "$(dirname "$0")"
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
U=$(cygpath -m "$PWD"); W=$(cygpath -w "$PWD")
shot() { local T; T=$(cygpath -w "$(mktemp -d)"); "$EDGE" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --user-data-dir="$T" --allow-file-access-from-files --virtual-time-budget=7000 --window-size=500,900 --screenshot="$(cygpath -w "$PWD/_raw.png")" "file:///$U/frame.html?$1" > /dev/null 2>&1
  MSYS_NO_PATHCONV=1 docker run --rm --memory=300m -v "$W:/t" vsk:1 ffmpeg -v error -y -i /t/_raw.png -vf crop=390:844:0:0 "/t/$2" < /dev/null; rm -f _raw.png; }
for X in A B C D; do
  T=$([ $X = A ] || echo "&theme=$X")
  shot "demo&clean$T" "theme-$X-today.png"
  shot "demo-month&clean$T" "theme-$X-stats.png"
done
ls -la theme-*.png
