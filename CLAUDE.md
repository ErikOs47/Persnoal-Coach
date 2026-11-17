# Formkurve – Übergabe für Claude-Sitzungen

Persönlicher Krafttrainings-Coach als PWA für einen einzelnen Nutzer. Reines HTML, CSS und ES-Module, kein Framework, kein Build-Schritt für die App, kein Server. Alle Daten liegen im `localStorage`. Sprache von Oberfläche, Kommentaren, Commits und Doku ist Deutsch.

Die fachlichen Regeln (Volumen, Progression, Deload usw.) stehen mit Quellen in `README.md` und in der App unter Profil → Wissen (`vWissen` in `js/app.js`). Diese Datei beschreibt, wie der Code gebaut ist und wo er Schwächen hat.

## Nutzer und Arbeitsweise

- Ziel Muskelaufbau, Wiedereinstieg nach längerer Pause, spielt Fußball, phasenweise leichte Kniebeschwerden. Trainiert im Gym und zuhause.
- Antworten ohne Einleitung, direkt zum Punkt. Aussagen mit Quellen belegen und erklären, wie man darauf kommt. Wenn der Nutzer falsch liegt, das sagen und mit Belegen korrigieren.
- Keine Quellen oder DOIs erfinden. Was nicht nachgeschlagen werden konnte, als ungeprüft kennzeichnen.
- Faustregeln ohne direkte Studie als solche benennen, in der App und in der README.

## Befehle

```bash
npm test             # Logik-Tests, node --test, keine Abhängigkeiten nötig
npm run serve        # http://localhost:8080
npm run build:sdk    # nur nach SDK-Update: bündelt @anthropic-ai/sdk nach vendor/
node --check js/app.js   # schneller Syntaxcheck nach Änderungen an der Oberfläche

# Browser-Durchlauf im iPhone-Format (braucht Playwright, ist kein devDependency)
npm run serve &
SHOTS=/tmp/shots NODE_PATH=$(npm root -g) node tools/e2e.mjs
```

`tools/e2e.mjs` ist ein Skript mit Ausgabe `ok`/`FAIL` pro Schritt und Screenshots, kein Test-Runner. Es läuft nicht in der CI.

## Veröffentlichung

- `.github/workflows/pages.yml`: bei Push auf `main` Tests, dann GitHub Pages. Bei Pull Requests nur Tests.
- Der Deploy-Schritt kopiert eine feste Liste von Ordnern nach `_site`. **Neue Top-Level-Ordner dort eintragen**, sonst fehlen sie auf der Live-Seite (so passiert mit `media/` in PR #2).
- Nach jeder Änderung an App-Dateien `VERSION` in `sw.js` erhöhen, sonst laden installierte Apps das Update nicht zuverlässig.

## Architektur

| Datei | Zeilen | Rolle |
| --- | --- | --- |
| `js/data.js` | ~163 | Stammdaten: Muskeln, Ausrüstung, 124 Übungen (`EX`), Split-Vorlagen (`TPL`, `SPLITS`), RIR-Reihen, `MEDIA` |
| `js/logic.js` | ~400 | Alle Regeln als reine Funktionen ohne DOM. Bekommt den Zustand `S` als Parameter. Getestet |
| `js/app.js` | ~810 | Zustand, Speicher, Routing, alle Ansichten als Template-Strings, ein zentraler Klick-Handler |
| `js/coach.js` | ~55 | Aufruf der Anthropic Messages API aus dem Browser |
| `tests/logic.test.mjs` | ~340 | 34 Tests für `logic.js` und `data.js` |
| `media/ex/` | 248 Dateien, 3,5 MB | Je zwei WebP pro Übung (`<id>-0.webp`, `<id>-1.webp`), für alle 124 Übungen |
| `tools/` | | `sdk-entry.mjs` (SDK-Bundle), `media.py` (Fotos laden und umrechnen, Zuordnung Übung → Datensatz), `draw.py` (Strichfiguren für Übungen ohne Foto), `e2e.mjs` |

### Ablauf in `app.js`

- Hash-Routing: `route()` liest `location.hash`, ruft die passende `v…`-Funktion, die `#app` komplett neu rendert. Kein virtuelles DOM, kein Teil-Update außer wenigen Stellen (`#exlist`, `#lastbubble`, Timer).
- Ein `document`-Klick-Handler verteilt über `data-act="…"`. Auswahlfelder ohne `data-act` (`[data-rd]`, `[data-pre]`, `[data-fb]`) werden am Anfang des Handlers behandelt, **vor** dem `closest('[data-act]')`-Return.
- `route()` ruft bei jedem Aufruf `L.deloadDecision(S)` und schreibt `plan.meso.deloadAt`, sobald die Entscheidung fällt.
- Speichern: `Store.save()` schreibt immer den ganzen Zustand. Argumente an `Store.save('…')` und `Store.del('…')` sind Altlast und werden ignoriert.
- `Store.migrate()` bringt alte Datenstände auf das aktuelle Format. Wird beim Start und beim Import aufgerufen. **Jedes neue Feld braucht dort oder in `DEFAULT_PROFILE` einen Standardwert.**

### Zustand `S` (localStorage `formkurve_v1`)

```
profile   Ziel, exp, weekdays[], dur, place (gym|home|both), equipment[] (Gym), equipHome[],
          limitLv {knee:1|2,…} → abgeleitet limits[] (stark) und mild[] (leicht),
          sportDays[], sportName, reentry, fav[], ban[], banWhy{}, mAdj{muskel:±n}, rirBias, volAdj (Altlast)
plan      created, meso {n, start, deloadAt?}, split, loc (Hauptort), reentry, T {muskel:ziel},
          days[] {key, name, capped, ex[]}
prog      {übungsId: {w, reps, fails, last}}   Arbeitsgewicht pro Übung, pro Ort getrennt, weil andere Übung
sessions  [] {id, date, day, week (1–4 Aufbau, 5 Deload), planCreated, rscore, light, loc, mins,
          entries[] {id, rr, fb {pain 0–2, feel 1–3, load 1–3}, sets[] {w, r, rir}}, results[]}
body      [] {d, kg}
cal       [] {d, id, meso, bias}                RIR-Kalibrierungssätze
notes     [] {d, t}                             Notizen des Coachs
meta      lastExport, lastExportSessions (Anzahl Trainings bei der letzten Sicherung), lastReview, plAck{}
loc       aktuell gewählter Ort bei place = both
```

Weitere Schlüssel: `formkurve_v1_draft` (laufendes Training `W`), `_chat`, `_coach` (API-Schlüssel und Modell), `_exf` (Filter der Bibliothek), `_undo` (Stand vor der letzten Wiederherstellung).

Sicherung: `L.backupFile` (Datei `{app, v, exported, data}`), `L.validateBackup` (Prüfung und Vorschau, liest auch alte Exporte ohne Hülle), `L.backupDue` (Erinnerung). In `app.js` `doBackup` (Web Share mit Datei, sonst Download) und `previewImport`.

### Plan-Eintrag und zwei Orte

Ein Eintrag in `plan.days[].ex[]`:

```
{slot, id, rr, rest, sets[5], alt, altRr, altRest, only?}
```

- `id`/`rr`/`rest` gelten am Hauptort `plan.loc`, `alt…` am anderen Ort. `alt: null` heißt: dort keine Variante.
- `only: 'home'` heißt: Eintrag existiert nur an diesem Ort.
- `sets` ist für beide Orte gleich: Index 0–3 Aufbauwochen, 4 Deload.
- **Nie direkt `e.id` lesen, wenn der Ort eine Rolle spielt.** Immer `L.viewAt(e, plan, loc)` oder `L.dayAt(plan, di, loc)`. Zum Ändern die Helfer in `app.js`: `setExercise`, `addExercise`, `removeExercise`, `replaceEx`.

### Wochenzählung

- `L.calWeek(S)`: Kalenderwoche im Zyklus, 1, 2, 3 …
- `L.mesoWeek(S)`: wirksame Woche. 1–4 Aufbau (Kalenderwoche 5 und 6 zählen als 4), 5 Deload, 6 Zyklus fertig. Der ganze übrige Code rechnet mit dieser Zahl, auch `session.week`.

### Coach

- `coachContext()` baut den Systemkontext aus dem Zustand, `COACH_TOOLS` definiert `propose_plan_changes` und `save_note`.
- Kein Tool-Loop: Die Antwort endet mit dem Tool-Aufruf. `findChange()` prüft jede Änderung, die App zeigt eine Karte, `applyChanges()` läuft erst nach Tipp des Nutzers. Im Verlauf werden Vorschläge als Klartext an die API zurückgegeben (`apiText`), nicht als `tool_use`/`tool_result`-Blöcke.
- Vor Änderungen an `coach.js` den Skill `claude-api` laden. Modell-IDs und Parameter ändern sich schneller als das Trainingswissen.

## Coding-Konventionen

- **Regeln gehören nach `logic.js`**, als reine Funktion mit `S` und optional `now` als Parameter, mit Test. `app.js` bindet sie nur an und rendert.
- Jede Regeländerung an drei Stellen nachziehen: Code, `vWissen` in `app.js`, Abschnitt „So rechnet Formkurve“ in `README.md`.
- `app.js` ist bewusst dicht geschrieben (kurze Namen, eine Zeile pro Handler). Den Stil beibehalten, nicht nebenbei umformatieren. `logic.js` und Tests sind normal formatiert.
- Kurznamen: `S` Zustand, `W` laufendes Training, `L` logic-Modul, `$` querySelector, `x` Übung aus `EX`, `e` Plan-Eintrag, `en` Trainings-Eintrag, `di`/`ei` Tag- und Übungsindex, `wk` wirksame Woche, `wi` Satz-Index.
- Alles, was aus Nutzereingaben oder vom Coach kommt, mit `esc()` in Templates einsetzen.
- Destruktive Aktionen nutzen das Zwei-Tipp-Muster (`b.dataset.c!=='1'`), kein `confirm()`.
- Keine neuen Abhängigkeiten zur Laufzeit. Externe Skripte gibt es nicht, nur Google Fonts als Stylesheet.
- Neue Übung: Eintrag in `EX` **ans Ende** anhängen (die Reihenfolge innerhalb eines Bewegungsmusters bestimmt die Standardauswahl). Felder: `id, n, p, m, s[], eq[], t (c|i), inc, bw?, av[]?, rr?, cue`. Jede Übung braucht zwei Bilder, ein Test prüft das: Foto über `tools/media.py` (Zuordnung ergänzen, ausführen) oder Zeichnung über `tools/draw.py`. Zeigt das Bild nicht genau die Übung, einen Hinweis in `MEDIA_NOTE` eintragen.
- Filterlogik der Bibliothek steckt in `L.filterEx`, die Auswahl wird pro Gerät in `formkurve_v1_exf` gemerkt.
- Farben nur über die CSS-Variablen in `:root`, Hell und Dunkel sind beide definiert.
- Commits auf Deutsch, eine Zeile Zusammenfassung. Pull Requests nur auf Wunsch des Nutzers.

## Bekannte Schwachstellen

Nach Schwere sortiert. Die ersten vier betreffen Datenverlust oder falsches Verhalten, der Rest Qualität.

1. **Daten nur im `localStorage`.** Kein Sync. iOS kann Daten eines nicht installierten Tabs nach einer Woche ohne Nutzung löschen; die App warnt im Profil, wenn sie im Tab läuft. Sicherung als Datei mit Erinnerung, aber nicht vollautomatisch, weil Browser Dateien nur nach einem Tipp speichern. Ob der Nutzer im Teilen-Menü wirklich speichert, kann die App nicht prüfen; jeder Abschluss des Teilen-Menüs zählt als Sicherung. Teilen mit Datei und Wiederherstellung auf einem echten iPhone sind ungetestet (nur Chromium mit iPhone-Profil, dort greift der Download-Weg).
2. **Coach nie gegen die echte API getestet.** Tool-Aufrufe, Streaming mit Tools und das gebündelte SDK 1.3.0 sind nur vom Code her geprüft. Der API-Schlüssel liegt im Klartext im `localStorage`.
3. **Zyklusabschluss, Deload-Auslöser, Plateau-Karten und Schmerz-Sperre über zwei Einheiten sind nur über Logik-Tests abgedeckt**, nicht im Browser, weil sie Wochen an Daten brauchen. `tools/e2e.mjs` deckt einen einzigen frischen Durchlauf ab.
4. **„Plan neu berechnen“ und jede strukturelle Profiländerung verwerfen eigene Planänderungen** (Sätze, hinzugefügte Übungen). Nur gleiche Übung pro Slot, Gewichte, Favoriten und Sperren bleiben.
5. **Schwellenwerte sind Faustregeln** von mir: Ermüdung (`fatigue`), Volumen pro Muskel (`mesoReview`), Sport-Abzug, Plateau, Kurztraining. Keine Kalibrierung an echten Daten.
6. **Übungsauswahl bei leichten Kniebeschwerden ist grob.** Im Gym landet für „Quadrizeps isoliert“ der Cyclist Squat mit Körpergewicht im Plan, weil der Beinstrecker als kniebelastend hintenangestellt wird und die Vorlage Index 1 nimmt. `av` ist ja/nein pro Region, ohne Abstufung.
7. **Kurztraining streicht bei 30 Minuten alle Isolationsübungen**, statt sie als Supersatz zu behalten. Die Supersatz-Kopplung in `trimToTime` greift dadurch selten.
8. **Wochenstreifen und Rotation passen nicht ganz zusammen.** `weekStrip` nutzt `nextDayIndex`, die Karte „Nächstes Training“ nutzt `pickDay`. Bei vorgezogenem Training zeigt der Streifen eine andere Reihenfolge.
9. **`weekVolume` rechnet die Planseite immer mit den Übungen des Hauptorts**, auch wenn zuhause trainiert wird. Bei unterschiedlichen Hilfsmuskeln weicht „geplant“ leicht ab.
10. **`rirBias` wirkt rückwirkend** auf alle 1RM-Schätzungen im Verlauf, auch auf Einheiten vor der Kalibrierung. Der Chart springt nach dem ersten Test.
11. **Sperre aufheben stellt den alten Plan nicht wieder her.** Die Übung ist nur wieder wählbar.
12. **Bilder:** Alle 124 Übungen haben Bilder, aber 11 zeigen dieselbe Bewegung mit anderem Gerät (Hinweis in `MEDIA_NOTE`) und 2 sind einfache Strichfiguren. Die Zuordnung Übung → Datensatz wurde nach Namen gemacht und bei 77 Übungen per Blick geprüft, bei 47 der ersten Runde noch nicht. Bilder werden nicht vorab gecacht, offline nur nach erstem Ansehen.
13. **Quellen 12, 14, 15** (Halperin 2022, Scarpelli 2020, Fonseca 2014) sind über PubMed-Suchen verlinkt, DOIs konnten nicht geprüft werden.
14. **`app.js` ist eine Datei mit ~810 dichten Zeilen** ohne Typen und ohne Oberflächen-Tests in der CI. Suchen per Funktionsname oder `data-act`.
15. **Altlasten:** `profile.volAdj` wird nicht mehr geschrieben, aber noch gelesen. `Store.save/del` mit Argumenten. Google Fonts werden extern geladen (offline Fallback auf Systemschrift).
16. **`<dialog>`** braucht iOS 15.4 oder neuer.
17. Repo-Name hat einen Tippfehler (`Persnoal-Coach`). Nicht umbenennen, die Pages-URL hängt daran.

## Offene To-dos

Reihenfolge ist ein Vorschlag, nichts davon ist mit dem Nutzer abgestimmt.

- [ ] Coach mit echtem API-Schlüssel durchtesten: Antwort, `propose_plan_changes` übernehmen und ablehnen, `save_note`.
- [ ] Zeitraffer-Test für mehrere Wochen: Zustand mit generierten Sessions füllen und Deload, Zyklusabschluss, Plateau im Browser prüfen. Als zweiter Modus in `tools/e2e.mjs`.
- [ ] Bildzuordnung der übrigen 47 Übungen der ersten Runde durchsehen (Kontaktbogen aus `media/ex/`).
- [ ] Sicherung auf einem echten iPhone prüfen: Teilen-Menü, „In Dateien sichern“, Wiederherstellen aus iCloud Drive.
- [ ] Eigene Planänderungen bei Neuberechnung erhalten (Einträge mit `slot >= 100` und geänderte Sätze übernehmen).
- [ ] Übungsauswahl bei Beschwerden verfeinern: `av` mit Stufe statt ja/nein, Maschinen vor Körpergewicht bevorzugen, wenn beides verfügbar ist.
- [ ] Kurztraining: Supersätze vor dem Streichen ausschöpfen.
- [ ] `weekStrip` auf `pickDay` umstellen.
- [ ] Ersatzfotos und Zeichnungen durch genaue Bilder ersetzen, sobald eine freie Quelle gefunden ist. Echte Videos gibt es nicht, nur den Link zur YouTube-Suche.
- [ ] Übungsbilder beim ersten Start im Hintergrund cachen (3,5 MB).
- [ ] DOIs der Quellen 12, 14, 15 nachschlagen und eintragen.
- [ ] `tools/e2e.mjs` in die CI aufnehmen (Playwright als devDependency).
- [ ] Altlasten entfernen: `volAdj`, Argumente von `Store.save/del`.
