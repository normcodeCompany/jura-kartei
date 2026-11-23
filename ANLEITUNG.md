# Jura-Kartei

Private Ablage für Definitionen, Prüfungsschemata und freie Karten – mit Karteikarten-Funktion.
Alle Inhalte bleiben auf dem jeweiligen Gerät. Kein Konto, kein Server, keine Cloud.

---

## Die Adresse

```
https://normcodecompany.github.io/jura-kartei/
```

Diese eine Adresse benutzt du auf **beiden** Geräten. Dort liegt nur das Programm –
deine Karten bleiben immer auf dem Gerät, auf dem du sie geschrieben hast.

---

## Auf dem iPhone einrichten

1. **Safari** öffnen (nicht Chrome – nur Safari kann Apps anlegen)
2. Adresse oben eingeben
3. Unten auf das **Teilen-Symbol** (Quadrat mit Pfeil nach oben)
4. Nach unten wischen → **Zum Home-Bildschirm** → **Hinzufügen**

Ab jetzt startest du die Kartei nur noch über das Symbol auf dem Home-Bildschirm.
Das ist wichtig: Nur so läuft sie **offline** – und nur so behält iOS deine Karten
dauerhaft. In einem normalen Safari-Tab löscht iOS die Daten nach sieben Tagen.

> Das Symbol danach **nicht** löschen – damit wären auch die Karten weg.

---

## Auf dem MacBook einrichten

Dieselbe Adresse in **Chrome** öffnen, dann oben rechts **⋮** →
*Streamen, Speichern und Teilen* → **Verknüpfung erstellen…** →
Haken bei *Als Fenster öffnen* → **Erstellen**.

Die Jura-Kartei liegt danach als eigene App im Dock, ohne Browser-Leiste,
und funktioniert auch ohne Internet.

### Ohne Internet und ohne GitHub arbeiten

Es geht auch ganz ohne Adresse: Doppelklick auf **`Start.command`** in diesem Ordner
startet die App unter `http://localhost:7345/`.

> **Achtung – getrennte Karteien.** Die lokale Variante und die Internet-Adresse
> haben **getrennte Datenspeicher**. Eine Karte, die du unter `localhost` anlegst,
> erscheint nicht unter der github.io-Adresse und umgekehrt.
> **Entscheide dich für einen Weg und bleib dabei** – am besten die Internet-Adresse,
> weil die auf beiden Geräten funktioniert.

---

## Die drei Kartentypen

| Typ | Vorderseite | Rückseite | wofür |
|---|---|---|---|
| **Definition** | Begriff | Definition, Fundstelle, Streitstand | Legaldefinitionen, Begriffe |
| **Schema** | Bezeichnung | nummerierter Prüfungsaufbau | Anspruchsgrundlagen, Aufbauschemata |
| **Frei** | Frage | Antwort | alles andere |

### Prüfungsschemata schreiben

Eine Zeile pro Punkt. **Die Nummerierung schreibst du selbst** – I., 1., a), aa),
A., (1), oder was immer du gewohnt bist. Die App rührt sie nicht an.

Mit **Tab** rückst du ein; das bestimmt nur, wie weit der Punkt optisch einzieht
(bis zu vier Stufen):

```
I. Rechtsgutsverletzung
→   1. Leben, Körper, Gesundheit
→   2. Sonstiges Recht
→   →   a) Gewerbebetrieb
II. Verletzungshandlung
```

### Formatierung in Textfeldern

`**fett**` · `*kursiv*` · Listen mit `- ` am Zeilenanfang.

---

## Ordner

Beliebig tief verschachtelbar (Zivilrecht › Schuldrecht AT › Leistungsstörungen …).

* **+** oben links: neuer Ordner
* **⋯** neben einem Ordner: umbenennen, verschieben, Unterordner anlegen, löschen
* Ein Ordner zeigt immer die Karten **inklusive** aller Unterordner.

---

## Lernen

**Wiederholen** (Standard) – nur fällige Karten, mit Lernplan nach dem
SM-2-Verfahren (wie Anki). Nach dem Aufdecken bewertest du:

| Taste | | Wirkung |
|---|---|---|
| `1` | Nochmal | kommt in dieser Runde wieder |
| `2` | Schwer | kurzer Abstand |
| `3` | Gut | normaler Abstand |
| `4` | Einfach | langer Abstand |

Unter jedem Knopf steht, wann die Karte dann wiederkommt.

**Durchblättern** – alle Karten der Reihe nach oder zufällig, ohne den Lernplan
zu verändern. Zum Nachschlagen und Vorbereiten.

### Wie du antwortest – jederzeit umschaltbar

Über der Karte stehen immer drei Knöpfe. Du kannst mitten in einer Karte wechseln;
die Wahl bleibt für die nächsten Karten erhalten.

| | wie es läuft |
|---|---|
| **Umdrehen** | Du beantwortest im Kopf und deckst dann auf. Am schnellsten. |
| **Eintippen** | Du formulierst die Antwort aus und vergleichst sie danach mit der Lösung. Am nächsten an der Klausur. |
| **Lücken** | Schlüsselwörter sind ausgeblendet, du füllst sie aus. Danach steht da, wie viele du getroffen hast – richtige grün, falsche rot mit der Lösung daneben. |

Bewertet wird in allen drei Fällen gleich: du entscheidest selbst, ob es „Gut" war.

#### Eigene Lücken festlegen

Normalerweise sucht die App die Lücken selbst aus – gleichmäßig über die Karte verteilt,
und bei derselben Karte immer dieselben. Willst du bestimmen, was abgefragt wird, setze
im Text **doppelte geschweifte Klammern**:

```
Besitz ist die {{tatsächliche Sachherrschaft}} über eine Sache.
```

Sobald auf einer Karte eine solche Markierung steht, fragt die App nur noch deine
eigenen ab. In der normalen Kartenansicht sind die Klammern unsichtbar. Es geht auch
mehr als ein Wort pro Lücke.

### Tastatur (Mac)

`Leertaste` aufdecken · `⌘ + ↩` prüfen · `1`–`4` bewerten · `←` `→` blättern ·
`N` neue Karte · `L` lernen · `/` suchen · `⌘ + ↩` speichern · `Esc` schließen

---

## Backup – bitte wirklich machen

Die Karten liegen **nur** im Speicher dieses Geräts. Löschst du die App vom
Home-Bildschirm oder den Browser-Speicher, sind sie weg.

**Einstellungen & Backup → Als Datei sichern** erzeugt eine `.json`-Datei.
Leg sie in iCloud Drive oder Google Drive. Faustregel: nach jeder größeren
Schreib-Session. Die Seitenleiste unten zeigt, wann du zuletzt gesichert hast,
und warnt nach zwei Wochen.

Zusätzlich legt die App **täglich einen Schnappschuss** auf dem Gerät ab (die letzten 15).
Der hilft bei Versehen – aber nicht, wenn das Gerät weg ist.

### Kartei von einem Gerät aufs andere bringen

1. Gerät A: *Als Datei sichern* (iPhone: *Teilen / in Dateien sichern* → iCloud Drive)
2. Gerät B: *Einstellungen & Backup* → Datei auswählen → **Zusammenführen**

**Zusammenführen** ergänzt nur, was auf Gerät B fehlt – vorhandene Karten bleiben
unangetastet. **Ersetzen** wirft den Stand auf Gerät B weg. Im Zweifel: Zusammenführen.

> Weil beide Geräte getrennt sammeln, kann es zu doppelten Karten kommen, wenn du
> dieselbe Definition auf beiden Geräten neu tippst. Besser: an einem Gerät schreiben,
> am anderen lernen.

---

## Was wo liegt

```
Jura-Kartei/
├── Start.command     ← Doppelklick: lokal starten (ohne Internet)
├── docs/             ← diese Dateien veröffentlicht GitHub Pages
├── build.js          ← kopiert Änderungen nach docs/
├── index.html        ← die App
├── app.js            ← Logik
├── styles.css        ← Gestaltung
├── sw.js             ← Offline-Betrieb
├── server.js         ← kleiner lokaler Webserver
├── manifest.webmanifest
├── gen-icons.js      ← erzeugt die App-Symbole neu
└── icons/
```

Die **Karten selbst stehen in keiner dieser Dateien** – sie liegen in der
IndexedDB des Browsers bzw. der iPhone-App. Dieser Ordner ist nur das Programm.

---

## Änderungen an der App veröffentlichen

Wenn an `index.html`, `app.js` oder `styles.css` etwas geändert wird:

```
cd ~/Jura-Kartei
node build.js
git add -A && git commit -m "Was geändert wurde" && git push
```

Nach ein bis zwei Minuten ist die neue Fassung unter der Adresse da. Auf dem iPhone
die App einmal schließen und neu öffnen. **Deine Karten bleiben dabei unberührt** –
Updates betreffen nur das Programm.
