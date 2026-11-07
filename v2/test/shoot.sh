#!/bin/bash
# Screenshots of the friends' screens with example data: test/friends-a.png (board, chat, a friend, club settings),
# friends-b.png (first visit, invite, all-time board, Danes with the club line), friends-c.png (Napredek with the cloud backup).
# Serve the repo first: docker run -d --rm --name rg-serve -p 127.0.0.1:8765:8765 -v "<repo>:/app" -w /app python:3.12-slim python3 -m http.server 8765
cd "$(dirname "$0")"
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
shot() { local T; T=$(cygpath -w "$(mktemp -d)"); "$EDGE" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --user-data-dir="$T" --virtual-time-budget=6000 --window-size=$2 --screenshot="$(cygpath -w "$PWD/$3")" "$1" > /dev/null 2>&1; }
shot 'http://127.0.0.1:8765/v2/test/screens.html?a' 1632,1524 friends-a.png
shot 'http://127.0.0.1:8765/v2/test/screens.html?b' 1632,1524 friends-b.png
shot 'http://127.0.0.1:8765/v2/test/screens.html?c' 414,1524 friends-c.png
ls -la friends-*.png
