#!/bin/sh
# Zips each app folder for Fruitfox (Settings › Apps › Get Apps). Bump "version" in the app's app.json and apps.json when it changes.
cd "$(dirname "$0")"
for d in */; do d=${d%/}; rm -f "$d.zip"; zip -qrX "$d.zip" "$d" -x '*.DS_Store'; done
