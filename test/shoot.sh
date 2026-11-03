#!/bin/bash
# Screenshots of the demo screens: test/screens.png (four long pages), screens2.png (timer, sheets, level up), screens3.png (finished book,
# month, new level, first start), screens4.png (screen setting, black screen, return question), levels.png (all 18 stages), ages.png (seven ages side by side) and icons.png (the app icon at real sizes).
# The first start needs the app served without data: docker run -d --rm --name rg-serve -p 127.0.0.1:8765:8765 -v "<repo>:/app" -w /app vsk:1 python3 -m http.server 8765
cd "$(dirname "$0")"
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
U=$(cygpath -m "$PWD")
shot() { local T; T=$(cygpath -w "$(mktemp -d)"); "$EDGE" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --user-data-dir="$T" --allow-file-access-from-files --virtual-time-budget=5000 --window-size=$2 --screenshot="$(cygpath -w "$PWD/$3")" "file:///$U/$1" > /dev/null 2>&1; }
shot screens.html 1632,1724 screens.png
shot screens2.html 2034,868 screens2.png
shot screens3.html 1632,868 screens3.png
shot screens4.html 2034,868 screens4.png
shot pins.html 414,1724 levels.png
shot '../index.html#demo-ages' 1640,330 ages.png
shot icons.html 1150,640 icons.png
ls -la *.png
