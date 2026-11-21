# Jura-Kartei

Private Karteikarten-App für juristische Definitionen und Prüfungsschemata.
Reines HTML/CSS/JavaScript, keine Abhängigkeiten, kein Build-Schritt, kein Framework.

**→ [ANLEITUNG.md](ANLEITUNG.md)** erklärt die Bedienung.

## Datenhaltung

Alle Karten liegen ausschließlich in der IndexedDB des jeweiligen Geräts.
Es gibt keinen Server, kein Konto und keine Übertragung von Inhalten.
Dieses Repository enthält nur das Programm. Abgleich zwischen Geräten
erfolgt bewusst manuell über JSON-Export und -Import.

## Aufbau

| Datei | Zweck |
|---|---|
| `index.html`, `app.js`, `styles.css` | die App |
| `sw.js` | Service Worker für Offline-Betrieb |
| `manifest.webmanifest`, `icons/` | Installation als App |
| `server.js`, `Start.command` | lokaler Betrieb auf dem Mac ohne Internet |
| `build.js` | kopiert die Web-Dateien nach `docs/` (GitHub Pages) |
| `gen-icons.js` | erzeugt die PNG-Symbole neu |

## Veröffentlichen

```sh
node build.js
git add -A && git commit -m "…" && git push
```

GitHub Pages liefert aus `docs/` auf dem Branch `main`.
