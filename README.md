# Formkurve

Persönlicher Trainingscoach als Web-App (PWA). Formkurve erstellt aus deinem Profil und deinen Zielen einen Krafttrainingsplan, steigert die Gewichte nach jedem Training automatisch, passt das Volumen an deine Erholung an und zeigt deinen Fortschritt. Ein optionaler Coach (Claude) beantwortet Fragen zu deinen Daten.

Läuft im Browser auf iPhone, Android und Desktop, lässt sich zum Home-Bildschirm hinzufügen und funktioniert offline.

## Funktionen

| Bereich | Was die App macht |
| --- | --- |
| Profil | Ziel (Muskelaufbau, Kraft, Fettabbau, Fitness), Erfahrung, Trainingstage, Zeit pro Einheit, Ausrüstung, Beschwerden (Schulter, Knie, unterer Rücken), Schwerpunkt-Muskeln, Körperdaten |
| Planerstellung | Split nach Anzahl Trainingstage, Übungsauswahl aus 68 Übungen passend zu Ausrüstung und Beschwerden, Sätze pro Muskel und Woche, Wiederholungsbereiche, Pausen |
| Periodisierung | Mesozyklen von 5 Wochen: Volumen steigt, Wiederholungsreserve sinkt, Woche 5 ist Deload. Danach automatische Auswertung und Anpassung für den nächsten Zyklus |
| Training | Tagesform-Check (Schlaf, Muskelkater, Energie), Satz-Logging mit Gewicht, Wiederholungen und RIR, Pausen-Timer, Bildschirm bleibt an |
| Progression | Doppelprogression mit RIR-Korrektur und Reset nach zwei verfehlten Einheiten |
| Fortschritt | Geschätztes 1RM pro Übung, Sätze pro Muskel diese Woche, Körpergewicht mit 7-Tage-Trend, Trainingstreue, Verlauf |
| Plan anpassen | Übungen tauschen, hinzufügen, entfernen; Sätze, Wiederholungen, Pausen und Gewicht frei änderbar; Woche wiederholen (Urlaub, Krankheit) |
| Coach | Claude bekommt Profil, Plan, letzte 10 Trainings und Gewicht als Kontext und berät auf Deutsch |
| Daten | Lokal im Browser, Export und Import als JSON |

## Vorbild und Abgrenzung

Funktionales Vorbild ist die iOS-App „MCI – Personal Training AI“ ([App Store](https://apps.apple.com/de/app/mci-personal-training-ai/id1645679272)): adaptiver Plan mit Mesozyklen, Anpassung an Fortschritt und Erholung, Übungsbibliothek. Formkurve übernimmt keine Texte, Namen, Grafiken oder Daten von MCI. Wie MCI seinen Plan intern berechnet, ist nicht veröffentlicht; Formkurve nutzt deshalb eigene, offengelegte Regeln auf Basis veröffentlichter Studien. Ernährungs-Tracking, 3D-Animationen und Community-Funktionen von MCI sind nicht enthalten.

Ein Kritikpunkt aus MCI-Rezensionen war, dass Übungen, Sätze und Wiederholungen im Plan nicht frei änderbar sind. In Formkurve ist alles änderbar.

## So rechnet Formkurve

Alle Regeln stehen in [`js/logic.js`](js/logic.js) und sind mit Tests in [`tests/logic.test.mjs`](tests/logic.test.mjs) abgesichert. In der App erklärt die Seite „So rechnet Formkurve“ (Profil → Wissen) dasselbe.

1. **Split**: 2–3 Tage Ganzkörper, 4 Tage Ober-/Unterkörper, 5 Tage Ober/Unter + Push/Pull/Beine, 6 Tage Push/Pull/Beine 2×. Damit wird jeder Muskel etwa 2× pro Woche trainiert [2].
2. **Volumen**: Zielwert pro Muskel und Woche (Woche 3) Anfänger 10, Fortgeschrittene 13, Erfahrene 16 Sätze; Waden, Bauch, Gesäß 4 weniger; Fettabbau −2; Schwerpunkt +4 [1]. Hilfsmuskeln zählen als halber Satz. Obergrenze ca. 20 Sätze pro Stunde Training.
3. **Mesozyklus**: Volumen 80/90/100/110 %, RIR 3/2/2/1 (Anfänger 3/3/2/2), Woche 5 Deload mit halben Sätzen, −10 % Last, RIR 4 [3][4][7].
4. **Wiederholungsbereiche**: Muskelaufbau 6–10 (Grundübungen) und 10–15 (Isolation); Kraft 3–6 und 8–12; Fettabbau/Fitness 8–12 und 10–15 bzw. 12–15 [5][6].
5. **Progression**: alle Sätze am oberen Ende → Gewicht + Schritt (Langhantel Beine 5 kg, Oberkörper 2,5 kg, Kurzhanteln 1–2 kg), bei RIR ≥ Ziel + 2 doppelter Schritt; im Bereich → Gewicht halten, +1 Wiederholung; zweimal unter dem Bereich → −10 % [5].
6. **Tagesform**: Durchschnitt aus Schlaf, Muskelkater, Energie ≤ 2,3 von 5 → 1 Satz weniger pro Übung, RIR +1 [8].
7. **Nächster Zyklus**: Trainingstreue ≥ 80 % und Erholung ≥ 3,5 → +1 Satz pro Muskel und Woche; Erholung < 2,5 → −2.
8. **Körpergewicht**: Fettabbau 0,5–1 % pro Woche [9], Muskelaufbau ca. 0,25–0,5 % pro Woche [10].
9. **1RM-Schätzung**: Epley mit Reserve, Gewicht × (1 + (Wiederholungen + RIR) / 30).

### Quellen

1. Schoenfeld, Ogborn, Krieger (2017). Dose-response relationship between weekly resistance training volume and increases in muscle mass. *J Sports Sci* 35(11). https://doi.org/10.1080/02640414.2016.1210197
2. Schoenfeld, Ogborn, Krieger (2016). Effects of resistance training frequency on measures of muscle hypertrophy. *Sports Med* 46(11). https://doi.org/10.1007/s40279-016-0543-8
3. Zourdos et al. (2016). Novel resistance training-specific RPE scale measuring repetitions in reserve. *J Strength Cond Res* 30(1). https://doi.org/10.1519/JSC.0000000000001049
4. Helms et al. (2016). Application of the repetitions in reserve-based RPE scale for resistance training. *Strength Cond J* 38(4). https://doi.org/10.1519/SSC.0000000000000218
5. ACSM (2009). Progression models in resistance training for healthy adults. *Med Sci Sports Exerc* 41(3). https://doi.org/10.1249/MSS.0b013e3181915670
6. Schoenfeld, Grgic et al. (2017). Strength and hypertrophy adaptations between low- vs. high-load resistance training. *J Strength Cond Res* 31(12). https://doi.org/10.1519/JSC.0000000000002200
7. Bell et al. (2023). Integrating deloading into strength and physique sports training programmes. *Sports Med Open* 9. https://doi.org/10.1186/s40798-023-00633-0
8. Greig et al. (2020). Autoregulation in resistance training: addressing the inconsistencies. *Sports Med* 50. https://doi.org/10.1007/s40279-020-01330-8
9. Helms, Aragon, Fitschen (2014). Evidence-based recommendations for natural bodybuilding contest preparation. *JISSN* 11:20. https://doi.org/10.1186/1550-2783-11-20
10. Iraki et al. (2019). Nutrition recommendations for bodybuilders in the off-season. *Sports* 7(7):154. https://doi.org/10.3390/sports7070154

## Installation auf dem iPhone

1. Die veröffentlichte Seite (GitHub Pages, siehe unten) in **Safari** öffnen.
2. Teilen-Symbol → **Zum Home-Bildschirm**.
3. Formkurve vom Home-Bildschirm starten. Als installierte App behält iOS die Daten dauerhaft; im normalen Safari-Tab kann iOS Website-Daten nach längerer Nichtnutzung löschen.

## Daten und Datenschutz

Alle Daten (Profil, Plan, Trainings, Gewicht) liegen nur im `localStorage` deines Browsers. Es gibt keinen Server und kein Konto. Daten werden nicht zwischen Geräten synchronisiert: unter Profil → Daten exportieren und auf dem neuen Gerät importieren.

## Coach einrichten (optional)

Der Coach ruft die Anthropic Messages API direkt aus dem Browser auf.

1. Auf https://console.anthropic.com einen API-Schlüssel anlegen, am besten mit Ausgabenlimit.
2. In Formkurve unter **Profil → Coach** den Schlüssel eintragen und ein Modell wählen (Standard: Claude Opus 5.5; Sonnet 5.5 und Haiku 5.5 sind günstiger).
3. Der Schlüssel bleibt auf dem Gerät und wird nur an `api.anthropic.com` gesendet. Abgerechnet wird über dein Anthropic-Konto.

Hinweis: Ein Schlüssel im Browser ist für eine private App auf dem eigenen Gerät vertretbar. Für eine App mit mehreren Nutzern gehört der Schlüssel auf einen Server.

## Entwicklung

```bash
npm install          # nur für Tests und den SDK-Build nötig
npm test             # Logik-Tests (node --test)
npm run serve        # lokaler Server auf http://localhost:8080
npm run build:sdk    # bündelt @anthropic-ai/sdk nach vendor/anthropic-sdk.mjs
```

Kein Build-Schritt für die App selbst: reines HTML, CSS und ES-Module. Nach Änderungen an App-Dateien `VERSION` in `sw.js` erhöhen, damit installierte Apps das Update laden.

### Aufbau

| Datei | Inhalt |
| --- | --- |
| `index.html` | App-Hülle, Navigation |
| `css/styles.css` | Gestaltung, Hell- und Dunkelmodus |
| `js/data.js` | Muskeln, Ausrüstung, Übungsbibliothek, Split-Vorlagen |
| `js/logic.js` | Planerstellung, Progression, Auswertungen (ohne DOM, getestet) |
| `js/app.js` | Ansichten und Bedienung |
| `js/coach.js` | Anbindung an die Anthropic API |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA: Offline-Modus und Installation |
| `vendor/anthropic-sdk.mjs` | Gebündeltes Anthropic-SDK 1.3.0 |

### Veröffentlichung

`.github/workflows/pages.yml` führt bei jedem Push auf `main` die Tests aus und veröffentlicht die App auf GitHub Pages. Einmalig nötig: Repository → Settings → Pages → Source: **GitHub Actions**.

## Hinweis

Formkurve ersetzt keine ärztliche oder physiotherapeutische Beratung. Bei Schmerzen Training unterbrechen und abklären lassen.
