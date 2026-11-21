# Jura-Kartei

Private Ablage für Definitionen, Prüfungsschemata und freie Karten – mit Karteikarten-Funktion.
Alle Inhalte bleiben auf dem jeweiligen Gerät. Kein Konto, kein Server, keine Cloud.

---

## Auf dem MacBook starten

Doppelklick auf **`Start.command`** (in diesem Ordner).

Es öffnet sich ein Terminal-Fenster und danach die App im Browser unter
`http://localhost:7345/`.

* Das Terminal-Fenster muss **offen bleiben**, solange du die App benutzt.
  Schließen = App beenden. Die Daten sind dann trotzdem gespeichert.
* Beim allerersten Mal fragt macOS eventuell nach. Falls der Doppelklick nichts tut:
  Rechtsklick auf `Start.command` → **Öffnen** → **Öffnen** bestätigen.

### Als eigenes Fenster (ohne Browser-Leiste)

In Chrome: oben rechts **⋮** → *Streamen, Speichern und Teilen* → **Verknüpfung erstellen**
→ Haken bei *Als Fenster öffnen*. Danach liegt die Jura-Kartei als eigene App im Dock.
Der `Start.command` muss trotzdem vorher laufen.

---

## Auf dem iPhone

Dafür braucht die App eine Internetadresse (https). Siehe Abschnitt
„iPhone einrichten" – der Weg wird separat festgelegt.

Sobald die Adresse steht:
Safari öffnen → Adresse eingeben → **Teilen-Symbol** → **Zum Home-Bildschirm**.

Erst danach ist es eine echte App: eigenes Symbol, Vollbild, **offline nutzbar**, und
iOS löscht die Daten nicht nach sieben Tagen (das passiert nur bei normalen Safari-Tabs).

---

## Die drei Kartentypen

| Typ | Vorderseite | Rückseite | wofür |
|---|---|---|---|
| **Definition** | Begriff | Definition, Fundstelle, Streitstand | Legaldefinitionen, Begriffe |
| **Schema** | Bezeichnung | nummerierter Prüfungsaufbau | Anspruchsgrundlagen, Aufbauschemata |
| **Frei** | Frage | Antwort | alles andere |

### Prüfungsschemata schreiben

Eine Zeile pro Punkt. Mit **Tab** einrücken = Unterpunkt (bis zu vier Ebenen).
Die Nummerierung macht die App:

```
Rechtsgutsverletzung                →  I.   Rechtsgutsverletzung
→   Leben, Körper, Gesundheit       →     1. Leben, Körper, Gesundheit
→   Sonstiges Recht                 →     2. Sonstiges Recht
→   →   Gewerbebetrieb              →        a) Gewerbebetrieb
Verletzungshandlung                 →  II.  Verletzungshandlung
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

### Tastatur (Mac)

`Leertaste` aufdecken · `1`–`4` bewerten · `←` `→` blättern ·
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
├── Start.command     ← Doppelklick zum Starten (Mac)
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
