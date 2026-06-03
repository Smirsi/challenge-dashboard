#!/usr/bin/env python3
"""WhatsApp-Challenge-Parser.

Liest den WhatsApp-Export (data/_chat.txt), extrahiert pro Saison die Punktestaende
je Teilnehmer, berechnet Soll-/Kickgrenze-Kurven, Status (Ampel) und Fun-Stats und
schreibt das Ergebnis als web/public/data.json.

Nur Standardbibliothek -> laeuft ohne pip in der GitHub Action.
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHAT_FILE = ROOT / "data" / "_chat.txt"
SEASONS_FILE = ROOT / "config" / "seasons.json"
ALIASES_FILE = ROOT / "config" / "aliases.json"
OVERRIDES_FILE = ROOT / "config" / "overrides.json"
OUT_FILE = ROOT / "web" / "public" / "data.json"

# Zeile mit Timestamp:  [TT.MM.JJ, HH:MM:SS] Absender: Nachricht
# (WhatsApp setzt teils ein unsichtbares LRM/U+200E vor die Zeile.)
# Tolerantes Zeilen-Format. Sekunden optional, Jahr 2- oder 4-stellig.
# (Whitespace wird vorher normalisiert, daher reicht \s hier.)
LINE_RE = re.compile(
    r"^\[(\d{1,2})\.(\d{1,2})\.(\d{2,4}),\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\]\s+(.*?):\s(.*)$"
)

# Schlagwoerter, die eine Orga-Ansage (kein Punktestand) markieren.
ORG_KEYWORDS = (
    "soll", "ziel", "kickgrenze", "grenze", "kick", "durchschnitt",
    "teilnehmer", "punkt", "challenge", "woche", "tag", "=",
)

# System-/Event-Erkennung (fuer Beitritt/Austritt/Kick).
EV_LEFT = re.compile(r"hat die Gruppe verlassen")
EV_REMOVED = re.compile(r"(hat .+ entfernt|wurde entfernt)")
EV_ADDED = re.compile(r"(hat .+ hinzugef[uü]gt|hat dich hinzugef[uü]gt)")
SYSTEM_HINTS = (
    "Gruppenbeschreibung", "Gruppenbild", "Gruppennamen", "Bild weggelassen",
    "Sticker weggelassen", "Dokument weggelassen", "Video weggelassen",
    "Audio weggelassen", "GIF weggelassen", "weggelassen",
    "Nachricht wurde gelöscht", "Nachricht wurde bearbeitet",
    "diese Nachricht gelöscht", "Ende-zu-Ende", "hat die Gruppe erstellt",
    "ein*e Admin", "bist jetzt", "Sicherheitsnummer",
)


def strip_emoji(text: str) -> str:
    """Entfernt Emojis, Variation-Selektoren und unsichtbare Steuerzeichen."""
    out = []
    for ch in text:
        cat = unicodedata.category(ch)
        # Cf=Format (LRM/ZWJ/Variation), So/Sk=Symbole/Emoji, Mn/Me=komb. Marken (Keycaps)
        if cat in ("Cf", "So", "Sk", "Cc", "Mn", "Me"):
            continue
        if ord(ch) >= 0x1F000:  # emoji-Bloecke
            continue
        if 0x2190 <= ord(ch) <= 0x2BFF:  # Pfeile/Symbole/Dingbats
            continue
        if 0x20D0 <= ord(ch) <= 0x20FF:  # komb. Symbol-Marken (Keycap U+20E3)
            continue
        out.append(ch)
    return "".join(out)


def normalize_name(raw: str) -> str:
    """Schluessel zur Identitaets-Zusammenfuehrung (klein, ohne ~, ohne Deko)."""
    n = raw.strip()
    if n.startswith("~"):
        n = n[1:].strip()
    n = strip_emoji(n)
    n = re.sub(r"[‪‬‎‏]", "", n)  # bidi-Marker
    n = re.sub(r"\s+", " ", n).strip().lower()
    n = n.rstrip(" .")
    return n


def clean_display(raw: str) -> str:
    """Huebscher Anzeigename (ohne ~, ohne fuehrende/abschliessende Deko)."""
    n = raw.strip()
    if n.startswith("~"):
        n = n[1:].strip()
    n = re.sub(r"[‪‬‎‏]", "", n)
    n = strip_emoji(n).strip()
    n = re.sub(r"\s+", " ", n).strip(" .")
    return n or raw.strip()


def parse_messages(text: str):
    """Liefert Liste von (datetime, sender_raw, body) inkl. mehrzeiliger Nachrichten."""
    msgs = []
    for raw_line in text.splitlines():
        # Whitespace normalisieren: schmales/geschuetztes Leerzeichen -> normal,
        # unsichtbare Bidi-/LRM-Marken am Zeilenanfang entfernen.
        line = (raw_line.replace(" ", " ").replace(" ", " ")
                .replace("‎", "").replace("‏", ""))
        m = LINE_RE.match(line)
        if m:
            dd, mm, yy, hh, mi, ss, sender, body = m.groups()
            year = int(yy) if len(yy) == 4 else 2000 + int(yy)
            try:
                dt = datetime(year, int(mm), int(dd), int(hh), int(mi), int(ss or 0))
            except ValueError:
                continue
            msgs.append([dt, sender, body])
        elif msgs:
            # Folgezeile einer mehrzeiligen Nachricht -> anhaengen.
            msgs[-1][2] += "\n" + line
    return msgs


def is_system(body: str) -> bool:
    return any(h in body for h in SYSTEM_HINTS)


def extract_score(body: str, goal: int):
    """Extrahiert einen Punktestand aus einer Nachricht oder None."""
    if is_system(body):
        return None
    t = strip_emoji(body).strip()
    if not t:
        return None
    low = t.lower()
    if any(kw in low for kw in ORG_KEYWORDS):
        return None
    m = re.match(r"^\s*(\d{1,3}(?:\.\d{3})+|\d+)", t)
    if not m:
        return None
    num = int(m.group(1).replace(".", ""))
    rest = t[m.end():].strip()
    low_rest = rest.lower()
    if low_rest.startswith("von"):  # "10.000 von 07.06.23-..." = Ziel-Ansage
        return None
    # zu viel Text dahinter => Satz, kein Punktestand
    words = re.findall(r"[A-Za-zÄÖÜäöüß]+", rest)
    if len(words) >= 3:
        return None
    if num < 0 or num > goal * 2:
        return None
    return num


def load_json(path: Path, default):
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return default


def is_phone(raw: str) -> bool:
    """Reiner Telefonnummern-Name (unsaved Kontakt)?"""
    s = re.sub(r"[\s\-‪‬‎‏+()/]", "", raw)
    return s.isdigit() and len(s) >= 6


def build_alias_map(raw_names, existing):
    """raw->canonical Map. Bestehende (manuelle) Zuordnungen bleiben erhalten.

    Reine Telefonnummern werden zu 'Anonym N' anonymisiert (auch im data.json),
    bleiben aber via aliases.json einem echten Namen zuordenbar.
    """
    canonical = dict(existing.get("canonical", {}))  # canonical -> [raw,...]
    raw_to_can = {}
    norm_to_can = {}
    anon_seen = set()
    for can, raws in canonical.items():
        norm_to_can.setdefault(normalize_name(can), can)
        m = re.match(r"Anonym (\d+)$", can)
        if m:
            anon_seen.add(int(m.group(1)))
        for r in raws:
            raw_to_can[r] = can
            norm_to_can.setdefault(normalize_name(r), can)

    def next_anon():
        n = 1
        while n in anon_seen:
            n += 1
        anon_seen.add(n)
        return f"Anonym {n}"

    for raw in sorted(raw_names):
        if raw in raw_to_can:
            continue
        norm = normalize_name(raw)
        if not norm:
            continue
        if norm in norm_to_can:
            can = norm_to_can[norm]
            canonical.setdefault(can, [])
            if raw not in canonical[can]:
                canonical[can].append(raw)
        else:
            can = next_anon() if is_phone(raw) else clean_display(raw)
            # Falls Anzeigename schon als canonical existiert, anhaengen.
            if can in canonical:
                if raw not in canonical[can]:
                    canonical[can].append(raw)
            else:
                canonical[can] = [raw]
                norm_to_can[norm] = can
        raw_to_can[raw] = canonical_for(raw, canonical)
    # raw_to_can frisch aufbauen (konsistent)
    raw_to_can = {}
    for can, raws in canonical.items():
        for r in raws:
            raw_to_can[r] = can
    return canonical, raw_to_can


def canonical_for(raw, canonical):
    for can, raws in canonical.items():
        if raw in raws:
            return can
    return clean_display(raw)


def kick_dates(start: date, end: date, anchor: date, as_of: date):
    """Alle 14-Tage-Kick-Sonntage im Saisonzeitraum bis as_of."""
    # zurueck zum ersten Kick >= start
    d = anchor
    while d - timedelta(days=14) >= start:
        d -= timedelta(days=14)
    out = []
    while d <= min(end, as_of):
        if d >= start:
            out.append(d)
        d += timedelta(days=14)
    return out


def soll(goal: int, start: date, end: date, day: date) -> float:
    T = (end - start).days
    t = max(0, min((day - start).days, T))
    return goal * t / T if T else 0.0


def kicklimit(goal, start, end, day, f0, f1) -> float:
    T = (end - start).days
    t = max(0, min((day - start).days, T))
    frac = f0 + (f1 - f0) * (t / T) if T else f0
    return soll(goal, start, end, day) * frac


def daterange_step(start: date, end: date, step_days: int):
    d = start
    while d <= end:
        yield d
        d += timedelta(days=step_days)


def main():
    if not CHAT_FILE.exists():
        sys.exit(f"Chat-Datei fehlt: {CHAT_FILE}")
    text = CHAT_FILE.read_text(encoding="utf-8")
    seasons_cfg = load_json(SEASONS_FILE, {"seasons": []})["seasons"]
    aliases = load_json(ALIASES_FILE, {})
    overrides = load_json(OVERRIDES_FILE, {"drop": [], "set": []})

    msgs = parse_messages(text)
    if not msgs:
        sys.exit(
            "FEHLER: Im Chat wurde keine einzige Nachricht erkannt. "
            f"Quelle hat {len(text)} Zeichen. Vermutlich wurde statt des "
            "Chat-Inhalts etwas anderes hochgeladen (z.B. nur der Datei-Titel) "
            "oder das Zeilenformat weicht ab. data.json bleibt unveraendert."
        )
    raw_names = {sender for _, sender, _ in msgs}
    canonical, raw_to_can = build_alias_map(raw_names, aliases)

    # aliases.json zurueckschreiben (gemergt) -> manuelle Pflege moeglich.
    ALIASES_FILE.write_text(
        json.dumps(
            {
                "_comment": "Identitaets-Mapping: canonical -> Liste roher WhatsApp-Namen. "
                            "Manuell zusammenfuehren/korrigieren; Aenderungen bleiben erhalten.",
                "canonical": {k: canonical[k] for k in sorted(canonical)},
            },
            ensure_ascii=False, indent=2,
        ),
        encoding="utf-8",
    )

    as_of = max(dt for dt, _, _ in msgs).date()

    # Events je canonical: letztes Beitritt/Austritt
    last_event = {}  # canonical -> (date, type)
    for dt, sender, body in msgs:
        ev = None
        if EV_LEFT.search(body):
            # "<Name> hat die Gruppe verlassen" -> Subjekt ist der Absender-Name i.d.R.
            ev = ("left", clean_display(sender))
        elif EV_REMOVED.search(body):
            ev = ("removed", None)
        if ev:
            who = ev[1] or clean_display(sender)
            last_event[who] = (dt.date(), ev[0])

    seasons_out = []
    for s in seasons_cfg:
        start = date.fromisoformat(s["start"])
        end = date.fromisoformat(s["end"])
        goal = s["goal"]
        f0 = s.get("kickStartFraction", 1 / 3)
        f1 = s.get("kickEndFraction", 1.0)
        s_as_of = min(as_of, end)

        # Punktestaende je Person sammeln
        people = {}  # canonical -> list[(date, score)]
        post_times = {}  # canonical -> list[datetime] (fuer Fun-Stats)
        for dt, sender, body in msgs:
            d = dt.date()
            if not (start <= d <= end):
                continue
            sc = extract_score(body, goal)
            if sc is None:
                continue
            # Zeitabhaengige Plausibilitaet: Wert darf nicht voellig ueber dem
            # liegen, was bis dato ueberhaupt moeglich waere (Tippfehler/Spass).
            allowed = soll(goal, start, end, d) * 3 + goal * 0.3
            if sc > allowed:
                continue
            can = raw_to_can.get(sender, clean_display(sender))
            people.setdefault(can, []).append((d, sc))
            post_times.setdefault(can, []).append(dt)

        # Overrides anwenden (gezieltes Entfernen einzelner Datenpunkte)
        # Format set: {"season": id, "name": canonical, "date": "YYYY-MM-DD", "score": N}

        kdates = kick_dates(start, end, date.fromisoformat(s["kickAnchor"]), s_as_of)
        cur_limit = kicklimit(goal, start, end, s_as_of, f0, f1)
        next_kick = next((kd for kd in
                          daterange_step(start, end, 14) if kd > s_as_of), None)
        # genauer: naechster Kick im Anchor-Raster
        if kdates:
            nk = kdates[-1] + timedelta(days=14)
        else:
            nk = date.fromisoformat(s["kickAnchor"])
        if nk > end:
            nk = None
        next_limit = kicklimit(goal, start, end, nk, f0, f1) if nk else cur_limit

        participants = []
        for can, pts in people.items():
            pts = sorted(pts, key=lambda x: x[0])
            # Bereinigung: grobe Spikes (Wert faellt danach stark) verwerfen
            cleaned = clean_series(pts)
            if not cleaned:
                continue
            last_date, last_score = cleaned[-1]
            first_date = cleaned[0][0]
            # Tagesserie fuer Chart (max-Score bis zu jedem Posting-Tag)
            series = [{"date": d.isoformat(), "score": sc} for d, sc in cleaned]

            days_inactive = (s_as_of - last_date).days
            ev = last_event.get(can)
            left = bool(ev and ev[1] in ("left", "removed") and ev[0] >= first_date)
            inactive = days_inactive > 14  # Regel: kein Eintrag in 14 Tagen = Kick

            if left or days_inactive > 28:
                status = "ausgeschieden"  # Gruppe verlassen/entfernt o. lange weg
            elif last_score < cur_limit:
                status = "gefahr"  # unter aktueller Kickgrenze
            elif next_limit and last_score < next_limit:
                status = "knapp"
            else:
                status = "sicher"

            # Pace / Prognose
            elapsed = max(1, (last_date - start).days)
            pace = last_score / elapsed  # Punkte pro Tag
            T = (end - start).days
            projected = round(pace * T)
            needed_per_day = max(0.0, (goal - last_score) / max(1, (end - s_as_of).days))

            participants.append({
                "name": can,
                "score": last_score,
                "firstDate": first_date.isoformat(),
                "lastDate": last_date.isoformat(),
                "daysInactive": days_inactive,
                "status": status,
                "left": left,
                "inactive": inactive,
                "series": series,
                "pace": round(pace, 1),
                "projected": projected,
                "neededPerDay": round(needed_per_day, 1),
                "reachesGoal": projected >= goal,
                "posts": len(pts),
            })

        participants.sort(key=lambda p: (-p["score"], p["lastDate"]))
        for i, p in enumerate(participants):
            p["rank"] = i + 1
            p["delta"] = round(p["score"] - soll(goal, start, end, s_as_of))

        # Soll-/Kickgrenze-Kurve (woechentlich) fuer den Chart
        curve = []
        for d in daterange_step(start, min(end, max(s_as_of, start)), 7):
            curve.append({
                "date": d.isoformat(),
                "soll": round(soll(goal, start, end, d)),
                "kick": round(kicklimit(goal, start, end, d, f0, f1)),
            })

        stats = build_stats(participants, post_times, people)

        seasons_out.append({
            "id": s["id"],
            "name": s["name"],
            "shortName": s["shortName"],
            "unit": s["unit"],
            "emoji": s.get("emoji", ""),
            "start": s["start"],
            "end": s["end"],
            "goal": goal,
            "asOf": s_as_of.isoformat(),
            "currentSoll": round(soll(goal, start, end, s_as_of)),
            "currentKickLimit": round(cur_limit),
            "nextKickDate": nk.isoformat() if nk else None,
            "nextKickLimit": round(next_limit) if nk else None,
            "kickDates": [d.isoformat() for d in kdates],
            "participants": participants,
            "curve": curve,
            "stats": stats,
            "champion": next((p["name"] for p in participants
                              if p["status"] != "ausgeschieden"), None),
        })

    out = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "asOf": as_of.isoformat(),
        "seasons": seasons_out,
    }
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"OK -> {OUT_FILE}")
    for s in seasons_out:
        print(f"  {s['id']}: {len(s['participants'])} Teilnehmer, "
              f"Fuehrender={s['champion']} ({s['participants'][0]['score'] if s['participants'] else 0}), "
              f"Soll={s['currentSoll']} Kick={s['currentKickLimit']}")


def clean_series(pts):
    """Bereinigt eine Punkteserie zu einer monoton steigenden Stand-Huellkurve.

    Kumulative Punktestaende koennen nur steigen. Wir (1) entfernen isolierte
    Spikes nach oben (Tippfehler) und (2) erzwingen die Laufzeit-Maximum-Huelle,
    sodass Zaehler-Resets ("15780 ... 16, 17, 19") oder Vertipper nach unten den
    Stand nicht mehr verfaelschen.
    """
    pts = sorted(pts, key=lambda x: x[0])
    if not pts:
        return pts
    # (1) isolierte Aufwaerts-Spikes entfernen (Wert >> Nachbarn, danach faellt es)
    despiked = []
    for i, (d, v) in enumerate(pts):
        prev_v = despiked[-1][1] if despiked else (pts[i - 1][1] if i > 0 else None)
        nxt = pts[i + 1][1] if i + 1 < len(pts) else None
        if prev_v is not None and nxt is not None and prev_v > 0:
            if v > prev_v * 3 and v > nxt * 3:
                continue
        # erster Punkt, der die Folgewerte massiv uebersteigt
        if i == 0 and nxt is not None and v > nxt * 3 and v > 50:
            continue
        despiked.append((d, v))
    # (2) Laufzeit-Maximum-Huelle erzwingen
    out = []
    run = -1
    for d, v in despiked:
        if v < run:
            continue
        run = v
        out.append((d, v))
    return out


def build_stats(participants, post_times, people):
    """Fun-Stats fuer die Saison."""
    if not participants:
        return {}
    # Groesster Tagessprung
    biggest_jump = {"name": None, "value": 0}
    for can, pts in people.items():
        pts = sorted(clean_series(sorted(pts)), key=lambda x: x[0])
        for a, b in zip(pts, pts[1:]):
            jump = b[1] - a[1]
            if jump > biggest_jump["value"]:
                biggest_jump = {"name": can, "value": jump, "date": b[0].isoformat()}
    # Nachteule: spaeteste durchschnittliche Posting-Uhrzeit
    night_owl = {"name": None, "hour": -1}
    for can, times in post_times.items():
        # Stunden, die "spaet" sind (>=20 oder <5) zaehlen
        late = [t for t in times if t.hour >= 22 or t.hour < 5]
        if len(late) > night_owl["hour"]:
            night_owl = {"name": can, "hour": len(late)}
    # Fleissigster Poster
    most_posts = max(participants, key=lambda p: p["posts"])
    return {
        "biggestJump": biggest_jump,
        "nightOwl": {"name": night_owl["name"], "count": night_owl["hour"]},
        "mostPosts": {"name": most_posts["name"], "count": most_posts["posts"]},
        "totalParticipants": len(participants),
        "kicked": sum(1 for p in participants if p["status"] in ("gefahr", "ausgeschieden")),
        "leader": participants[0]["name"],
    }


if __name__ == "__main__":
    main()
