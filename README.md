# 💪⛰️ Challenge Dashboard

Automatisch aus dem WhatsApp-Export generiertes Web-Dashboard für die jährliche
Klimmzug-/Höhenmeter-Challenge: Live-Rangliste, Kick-Risiko-Ampel, Verlaufs-Charts,
Prognose und Hall of Fame über alle Saisons. Läuft **komplett gratis** auf GitHub Pages,
**ohne Server**.

## So funktioniert's

```
Handy: WhatsApp-Chat exportieren
        │  (Kurzbefehl aktualisiert einen PRIVATEN Gist + triggert die Action)
        ▼
Privater Gist  ──(CI holt ihn per Secret CHAT_URL)──►  GitHub Action (öffentl. Repo)
                                                          1. parse.py  → data.json
                                                          2. vite build → statische Seite
        ▼
GitHub Pages  →  https://<user>.github.io/<repo>/
```

**Privatsphäre:** Der rohe WhatsApp-Chat **und** das Alias-Mapping (`aliases.json`,
enthält die Telefonnummern) werden **nie** ins öffentliche Repo committet, sondern liegen
in einem privaten Gist. Öffentlich (in `data.json` / auf der Seite) sind nur Namen +
Punkte; reine Telefonnummern erscheinen als „Anonym N". Bei jedem Update läuft die Action
und aktualisiert die Seite (zusätzlich täglich per Zeitplan).

## Projektstruktur

| Pfad | Zweck |
|------|-------|
| `data/_chat.txt` | Roher WhatsApp-Export (wird vom Handy überschrieben) |
| `config/seasons.json` | Saison-Definitionen: Zeitraum, Ziel, Kickgrenze-Parameter |
| `config/aliases.json` | Identitäts-Mapping (auto-generiert, **manuell korrigierbar**) — **privat, nicht im Repo** (enthält Telefonnummern); liegt im privaten Gist |
| `config/overrides.json` | Platz für manuelle Wert-Korrekturen |
| `scripts/parse.py` | Parser + alle Berechnungen (nur Python-Stdlib) |
| `web/` | Vite + React + TypeScript + Recharts Frontend |
| `.github/workflows/build.yml` | CI: parsen → bauen → deployen |

## Lokal ausführen

```bash
# 1. Daten parsen (erzeugt web/public/data.json)
python3 scripts/parse.py

# 2. Frontend starten
cd web
npm install
npm run dev      # http://localhost:5173
```

## Identitäten zusammenführen

Dieselbe Person taucht in WhatsApp teils unter mehreren Namen/Nummern auf
(`~ Maximilian K.` vs. `Maximilian K.`). Der Parser legt automatisch
`config/aliases.json` an und führt offensichtlich gleiche Namen zusammen.

Zum Korrigieren: in `config/aliases.json` unter `canonical` den gewünschten
Anzeigenamen wählen und die rohen Namen in seine Liste verschieben. Beispiel:

```json
"Maximilian K.": ["~ Maximilian K.", "Maximilian K.", "+43 660 XXXXXXX"]
```

Manuelle Änderungen bleiben bei jedem Lauf erhalten.

## Kickgrenze-Formel

Pro Saison in `config/seasons.json`:

- `Soll(t) = goal · t/T` (linear über die Saison)
- `Teiler(t) = (1/kickStartFraction) + ((1/kickEndFraction) − (1/kickStartFraction)) · t/T`
- `Kickgrenze(t) = Soll(t) / Teiler(t)`

Standard: `kickStartFraction = 1/3`, `kickEndFraction = 1` → der **Teiler läuft linear
von 3 auf 1**. Damit ist die Kickgrenze am Anfang 1/3 des Solls und am Ende das volle
Soll, dazwischen aber milder als eine reine Gerade (z. B. zur Saisonmitte 1/2 statt 2/3
des Solls). Äquivalent: `Kickgrenze(t) = goal · t / (3T − 2t)`.

Das entspricht exakt dem offiziellen Algorithmus
`points_kick = Soll / (1 + 2 · verbleibendeTage / T)`.

## Deployment einrichten (einmalig)

1. **Privater Gist** mit Chat (und optional Alias-Mapping). Enthält die sensiblen
   Daten und bleibt geheim:
   ```bash
   python3 scripts/parse.py                 # erzeugt einmalig config/aliases.json lokal
   gh gist create data/_chat.txt config/aliases.json \
     --desc "Challenge Roh-Daten (privat)"  # geheimer (unlisted) Gist
   ```
   Danach die *raw*-URLs beider Dateien holen:
   ```bash
   gh api gists/<id> --jq '.files["_chat.txt"].raw_url'
   gh api gists/<id> --jq '.files["aliases.json"].raw_url'
   ```
2. **Secrets setzen** im öffentlichen Repo:
   ```bash
   gh secret set CHAT_URL    --body "<raw-URL von _chat.txt>"
   gh secret set ALIASES_URL --body "<raw-URL von aliases.json>"   # optional
   ```
3. GitHub → **Settings → Pages → Source: GitHub Actions**.
4. Action manuell starten (*Actions → Build & Deploy → Run workflow*). Danach ist die
   Seite unter `https://<user>.github.io/<repo>/` live.

## 📱 Halbautomatischer Upload vom Handy

Ziel: Nach dem Export mit wenigen Taps den **privaten Gist** aktualisieren und den
Build triggern.

**Voraussetzung – GitHub-Token:** GitHub → Settings → Developer settings →
Fine-grained tokens → *Generate new token* mit Permission **Gists: Read and write**
(und, falls der Build sofort statt erst per Zeitplan laufen soll, **Actions: write**
für das Repo).

### iOS (Kurzbefehle)

1. WhatsApp → Chat → ⋯ → **Chat exportieren → Ohne Medien** → an den Kurzbefehl teilen.
2. Kurzbefehl-Logik:
   - Datei empfangen, falls `.zip` entpacken, `_chat.txt` als **Text lesen**
   - **Inhalte von URL abrufen** (Gist aktualisieren):
     - URL: `https://api.github.com/gists/<gist-id>`
     - Methode: `PATCH`
     - Header: `Authorization: Bearer <TOKEN>`, `Accept: application/vnd.github+json`
     - Body: `{"files":{"_chat.txt":{"content":"<DATEITEXT>"}}}`
   - *(optional, sofortiger Build)* zweiter Request:
     - `POST https://api.github.com/repos/<user>/<repo>/actions/workflows/build.yml/dispatches`
     - Body: `{"ref":"main"}`
3. Künftig: Chat exportieren → Kurzbefehl wählen → fertig. (Ohne den optionalen
   zweiten Request aktualisiert sich die Seite spätestens beim täglichen Zeitplan-Lauf.)

### Android (HTTP Shortcuts / Tasker)

Analog mit **HTTP Shortcuts** oder Tasker: `_chat.txt` lesen und denselben
`PATCH`-Request an die Gist-API senden (plus optional den `dispatches`-Request).

> Der exakte Kurzbefehl/Token-Setup lässt sich beim ersten Einrichten gemeinsam finalisieren.
