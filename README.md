# To-do-list – Reinigung, Unterhalt & Erledigungen

Webapp für mehrere Personen: einmalige und wiederkehrende Aufgaben planen, zuteilen, abhaken – mit Fotos und Push-Nachrichten.

**Stack:** statisches Frontend (Vanilla JS, als App installierbar) · Netlify Functions (`/api/*` + stündlicher Job) · Netlify Blobs als Datenspeicher · Web Push.

## Funktionen
- **Termine**
  - *Einmalig* – mit Datum oder „ohne Termin“; verschwindet nach dem Abhaken (unter „Alle“ weiter einsehbar)
  - *Wiederholen ab Erledigung* oder *im festen Takt* (alle X Tage/Wochen/Monate/Jahre)
  - *Jede Woche an bestimmten Tagen* (z. B. Mo + Do, auch alle 2 Wochen)
  - *Jeden Monat an einem Tag* (z. B. am 15. oder am Monatsletzten)
  - *Jedes Jahr an festen Daten* – ein oder mehrere Daten, z. B. Reifenwechsel 1.4. und 15.10.
- **Zuteilung:** niemand fest, bestimmte Person oder abwechselnd
- **Abhaken** mit einem Tipp (mit Rückgängig) oder mit Datum, Notiz und Fotos
- **Fotos** an Aufgaben (Anleitung, Ersatzteil) und an Erledigungen; werden vor dem Hochladen verkleinert
- **Push-Nachrichten:** tägliche Übersicht zur gewünschten Uhrzeit und Meldung, wenn man eine Aufgabe zugeteilt bekommt oder an der Reihe ist
- **Vorlagen** für Küche, Bad, Geräte, Haus & Technik, Garten, Fahrzeuge
- **Verlauf** und Team-Übersicht

## Deployment
Push auf `main` → Netlify deployt automatisch.

Umgebungsvariablen in Netlify:
- `SESSION_SECRET` – langer Zufallsstring (Pflicht)
- `TEAM_CODE` – Code für die Registrierung
- optional `APP_TIMEZONE` (Standard `Europe/Zurich`), `VAPID_SUBJECT` (Standard: Site-URL)

Die Schlüssel für Push (VAPID) erzeugt die App beim ersten Gebrauch selbst und legt sie in Netlify Blobs ab.

## Push auf dem iPhone
Push funktioniert auf iOS ab 16.4 nur, wenn die App zum Home-Bildschirm hinzugefügt wurde:
Safari → Teilen → „Zum Home-Bildschirm“ → App von dort öffnen → Konto → Benachrichtigungen → Einschalten.

## Struktur
```
netlify/functions/api.mjs        # Function: API (/api/*)
netlify/functions/reminders.mjs  # Function: stündlicher Job
netlify/lib/api.mjs              # API-Logik, Auth, Aufgaben, Fotos, Push-Abos
netlify/lib/schedule.mjs         # Termin-Berechnung
netlify/lib/push.mjs             # Web Push (VAPID)
netlify/lib/notify.mjs           # tägliche Übersicht
public/                          # Frontend, Service Worker, Icons
```
