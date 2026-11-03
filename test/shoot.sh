#!/bin/bash
# Screenshots of the demo screens: test/screens.png (four long pages), screens2.png (timer, sheets, level up), screens3.png (finished book, new pin, first start).
cd "$(dirname "$0")"
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
U=$(cygpath -m "$PWD")
shot() { local T; T=$(cygpath -w "$(mktemp -d)"); "$EDGE" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --user-data-dir="$T" --allow-file-access-from-files --virtual-time-budget=5000 --window-size=$2 --screenshot="$(cygpath -w "$PWD/$3")" "file:///$U/$1" > /dev/null 2>&1; }
shot screens.html 1632,1724 screens.png
shot screens2.html 2034,868 screens2.png
shot screens3.html 1230,868 screens3.png
ls -la *.png
