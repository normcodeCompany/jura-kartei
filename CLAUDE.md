# Jura-Kartei – Projektanweisungen

## Was das ist

Karteikarten-App für juristische Definitionen und Prüfungsschemata.
Reines HTML/CSS/JavaScript. **Keine Abhängigkeiten, kein Framework, kein Build-Tool,
kein npm install.** Das ist Absicht und soll so bleiben, solange es geht.

Live: https://normcodecompany.github.io/jura-kartei/

## Mit wem du arbeitest

Basti ist **kein Entwickler**. Antworte auf **Deutsch**. Erkläre Konsequenzen statt
Implementierungsdetails. Wenn eine Entscheidung ansteht, nenne eine Empfehlung mit
Begründung, nicht nur eine Liste von Möglichkeiten.

## Harte Regeln

1. **Seine Karten sind heilig.** Sie liegen ausschließlich in der IndexedDB seiner
   Geräte – es gibt keine Kopie auf einem Server, die man zurückspielen könnte.
   Vor jeder Änderung am Datenmodell: Backup verlangen und Migration mitliefern.
2. **Keine neuen Abhängigkeiten ohne Rückfrage.** Jedes Paket ist etwas, das er
   später nicht selbst warten kann.
3. **Deutsche Bezeichner und Kommentare** im Code – passend zum Bestand
   (`renderListe`, `kartenIn`, `zuruecksetzen`).
4. **Service-Worker-Version hochzählen** (`sw.js`, `const VERSION`), sonst erreicht
   ein Update die installierten Apps nicht.
5. **Nach Änderungen an den Web-Dateien `node build.js`** – sonst geht nichts live.

## Starten und Testen

```sh
node server.js          # http://localhost:7345/
node build.js           # kopiert Web-Dateien nach docs/ (GitHub Pages)
node gen-icons.js       # erzeugt die PNG-Symbole neu
node --check app.js     # Syntaxprüfung
```

**Es gibt keine Testsuite.** Geprüft wird mit echtem Chrome über das DevTools-Protokoll
(Node 22+ bringt `WebSocket` mit, es braucht kein Paket). Muster:

```js
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ['--headless=new','--remote-debugging-port=9222','--user-data-dir=/tmp/x','about:blank']);
// dann /json/list abrufen, WebSocket öffnen, Runtime.evaluate schicken
```

Immer mitprüfen: **Mobilansicht** (390×844, `Emulation.setDeviceMetricsOverride`),
**kein horizontaler Überlauf** (`scrollWidth === innerWidth`), **Persistenz nach Reload**,
**Offline-Betrieb** (`Network.emulateNetworkConditions {offline:true}`) und
**leere Konsole** (`Runtime.exceptionThrown`).

Headless-Screenshots mit `--virtual-time-budget` sind unbrauchbar: IndexedDB-Rückrufe
laufen unter virtueller Zeit nicht, die Seite wirkt dann fälschlich leer.

## Aufbau

| Datei | Zweck |
|---|---|
| `index.html` | Gerüst: Seitenleiste, Hauptbereich, Overlay |
| `app.js` | alles andere, in 12 nummerierten Abschnitten |
| `styles.css` | Tokens auf `:root`, Dunkelmodus dreifach abgesichert |
| `sw.js` | Offline-Cache, `VERSION` hochzählen bei Updates |
| `server.js` / `Start.command` | lokaler Betrieb ohne Internet |
| `build.js` | Web-Dateien → `docs/` |

### Datenmodell

Ein einziges JSON-Objekt unter dem IndexedDB-Schlüssel `state`:

```js
{ version, folders: [{id, parentId, name}], cards: [...], settings: {...} }
```

Karte: `{ id, type, title, fields, tags, folderId, created, updated, srs }`
mit `type` ∈ `definition` | `schema` | `frei` und
`srs = { due: 'YYYY-MM-DD', ivl, ease, reps, lapses }` (SM-2).

`fields.points` bei Schema-Karten: `[{level: 0..3, text}]` – **`text` enthält die
Nummerierung, die der Nutzer selbst getippt hat.** Die App nummeriert nicht.

Tägliche Schnappschüsse unter `backup:<zeitstempel>`, die letzten 15.

## Fallen, die schon zugeschnappt sind

- `[hidden]` verliert gegen `#id{display:flex}` – deshalb steht
  `[hidden]{display:none !important}` ganz oben in `styles.css`.
- CSS-Regeln, die unter `.cardview` verschachtelt sind, greifen nicht im Lernbildschirm.
  `.block-label` und `.note` sind deshalb zusätzlich global definiert.
- Lücken im Lückentext werden **pro Karte** budgetiert, nicht pro Zeile. Sonst
  bekommt ein 20-zeiliges Schema über 20 Lücken.
- `localhost:7345` und die github.io-Adresse haben **getrennte Datenspeicher**.
  Bei „meine Karten sind weg": zuerst fragen, über welche Adresse geschrieben wurde.
