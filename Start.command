#!/bin/zsh
cd "$(dirname "$0")" || exit 1
clear
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js wurde nicht gefunden. Bitte von https://nodejs.org installieren."
  echo "Fenster kann geschlossen werden."
  read -r
  exit 1
fi
( sleep 1; open "http://localhost:7345/" ) &
exec node server.js
