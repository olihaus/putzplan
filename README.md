# Putzplan – Reinigungs- & Unterhalts-Tracker

Webapp für mehrere Benutzer:innen: Aufgaben anlegen oder aus Vorlagen generieren, Intervalle festlegen, Personen zuweisen (fest oder in Rotation) und erledigte Aufgaben tracken.

**Stack:** statisches Frontend (Vanilla JS, als App installierbar) · eine Netlify Function (`/api/*`) · Netlify Blobs als Datenspeicher. Es braucht keine externe Datenbank.

## Deployment (GitHub → Netlify)

1. Den Ordner in ein neues GitHub-Repo pushen (z. B. `putzplan`).
2. In Netlify: **Add new site → Import an existing project** → das Repo wählen. Build-Einstellungen leer lassen, `netlify.toml` regelt das.
3. Unter **Site configuration → Environment variables** diese Variablen setzen:
   - `SESSION_SECRET` – langer Zufallsstring (z. B. `openssl rand -hex 32`)
   - `TEAM_CODE` – Code, den neue Mitglieder bei der Registrierung eingeben müssen
   - `RESEND_API_KEY` – API-Key von resend.com (für E-Mail-Erinnerungen)
   - `MAIL_FROM` – Absender, z. B. `Putzplan <putzplan@deinedomain.ch>` (Domain muss in Resend verifiziert sein; ohne eigene Domain: `onboarding@resend.dev`, das stellt aber nur an die eigene Resend-Konto-Adresse zu)
   - optional `APP_URL` (Link in der Mail, Standard: Netlify-URL) und `APP_TIMEZONE` (Standard `Europe/Zurich`)
4. Neu deployen (**Deploys → Trigger deploy**).

> Netlify Drop (Ordner per Drag & Drop) funktioniert nicht, weil die Function gebaut werden muss. Alternativ geht es mit der CLI: `npm i && npx netlify deploy --prod`.

## Erste Schritte
- Die erste registrierte Person wird **Admin** und darf Mitglieder entfernen.
- Weitere Personen einladen: URL + Team-Code teilen → „Registrieren“.
- Auf dem iPhone: Safari → Teilen → „Zum Home-Bildschirm“.

## Funktionen
- **Fällig:** Übersicht mit überfälligen, heutigen und kommenden Aufgaben; Filter „Nur meine“.
- **Erledigt / Überspringen:** mit Datum und Notiz; ein Eintrag lässt sich im Verlauf rückgängig machen.
- **Rhythmus:**
  - *Ab Erledigung* – nächste Fälligkeit = Erledigt-Datum + Intervall
  - *Fester Rhythmus* – Raster ab Startdatum bleibt gleich, auch wenn später erledigt
  - *Bestimmter Tag* – wöchentlich an Wochentagen (z. B. jeden Mo + Do, alle 2 Wochen am Fr), monatlich an einem Tag (z. B. am 15. oder am letzten Tag; der 31. fällt in kürzeren Monaten auf den letzten Tag) oder jährlich an einem Datum (z. B. 15. März; der 29.02. fällt in Nicht-Schaltjahren auf den 28.02.)
- **Zuweisung:** niemand, feste Person oder Rotation zwischen ausgewählten Mitgliedern (nach jeder Erledigung ist die nächste Person dran).
- **Generieren:** über 40 Vorlagen (Küche, Bad, Geräte, Haus & Technik, Garten, Fahrzeuge); Intervalle anpassbar, Fälligkeiten werden verteilt.
- **E-Mail-Erinnerungen:** tägliche Zusammenfassung der überfälligen und heute fälligen Aufgaben, Uhrzeit pro Person wählbar (👤 → Erinnerungen, inkl. Test-Mail). Eine Scheduled Function (`reminders.mjs`) läuft stündlich und verschickt pro Person höchstens eine Mail pro Tag, nur wenn etwas fällig ist.
- **Team:** Statistik pro Person (erledigt in den letzten 30 Tagen, zugewiesene Aufgaben).

## Struktur
```
netlify.toml
package.json
netlify/functions/api.mjs   # Einstieg, Netlify Blobs
netlify/functions/lib.mjs   # API-Logik, Auth, Intervall-Berechnung
netlify/functions/mail.mjs  # Resend-Versand, Mail-Inhalt
netlify/functions/schedule.mjs  # Intervall- und Kalender-Berechnung
netlify/functions/reminders.mjs  # stündliche Scheduled Function
public/                     # Frontend
```
