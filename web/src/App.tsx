import { useEffect, useMemo, useState } from "react";
import type { Data, Season } from "./types";
import { fmt, fmtDate, daysUntil } from "./lib/format";
import Leaderboard from "./components/Leaderboard";
import RaceChart from "./components/RaceChart";
import HallOfFame from "./components/HallOfFame";
import FunStats from "./components/FunStats";

export default function App() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [seasonId, setSeasonId] = useState<string>("");

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data.json`, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: Data) => {
        setData(d);
        // Standard: letzte (aktuelle) Saison
        setSeasonId(d.seasons[d.seasons.length - 1]?.id ?? "");
      })
      .catch((e) => setErr(String(e)));
  }, []);

  const season: Season | undefined = useMemo(
    () => data?.seasons.find((s) => s.id === seasonId),
    [data, seasonId]
  );

  if (err)
    return (
      <Center>
        <p className="text-rose-400">Konnte data.json nicht laden: {err}</p>
      </Center>
    );
  if (!data || !season) return <Center>Lade Daten…</Center>;

  const daysToKick = daysUntil(season.nextKickDate, season.asOf);

  return (
    <div className="min-h-full max-w-6xl mx-auto px-4 pb-24">
      {/* Header */}
      <header className="pt-7 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-mut text-sm tracking-wide uppercase">Challenge Dashboard</div>
            <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight">
              <span className="mr-2">{season.emoji}</span>
              {season.name}
            </h1>
            <div className="text-mut text-sm mt-1">
              {fmtDate(season.start)} – {fmtDate(season.end)} · Stand{" "}
              <span className="text-slate-200">{fmtDate(season.asOf)}</span>
            </div>
          </div>
          <SeasonSwitcher
            seasons={data.seasons}
            active={seasonId}
            onSelect={setSeasonId}
          />
        </div>

        {(season.motivation || (season.rules && season.rules.length > 0)) && (
          <div className="card p-4 mt-4">
            {season.motivation && (
              <p className="text-lg font-bold text-slate-100">
                💪 {season.motivation}
              </p>
            )}
            {season.rules && season.rules.length > 0 && (
              <div className="mt-2">
                <div className="text-mut text-xs uppercase tracking-wide mb-1.5">
                  Punkte-Regeln
                </div>
                <ul className="flex flex-wrap gap-2">
                  {season.rules.map((r, i) => (
                    <li
                      key={i}
                      className="text-sm font-semibold text-slate-200 bg-white/5 rounded-full px-3 py-1"
                    >
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Stat-Karten */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label={`Ziel (${season.unit})`} value={fmt(season.goal)} accent="cyan" />
        <Stat label="Soll aktuell" value={fmt(season.currentSoll)} accent="lime" />
        <Stat
          label="Kickgrenze aktuell"
          value={fmt(season.currentKickLimit)}
          accent="rose"
          sub={
            season.nextKickLimit
              ? `nächste: ${fmt(season.nextKickLimit)}`
              : undefined
          }
        />
        <Stat
          label="Nächster Kick"
          value={
            daysToKick != null && daysToKick >= 0
              ? `${daysToKick} Tage`
              : season.nextKickDate
              ? fmtDate(season.nextKickDate)
              : "—"
          }
          accent="amber"
          sub={season.nextKickDate ? fmtDate(season.nextKickDate) + " · So 18:00" : "Saison-Ende"}
        />
      </section>

      <Leaderboard season={season} />
      <RaceChart season={season} />
      <FunStats season={season} />
      <HallOfFame data={data} onJump={setSeasonId} />

      <footer className="mt-12 text-center text-xs text-mut">
        Automatisch generiert aus dem WhatsApp-Export · {fmtDate(data.asOf)} ·
        Kickgrenze = konfigurierbare Formel (siehe README)
      </footer>
    </div>
  );
}

function SeasonSwitcher({
  seasons,
  active,
  onSelect,
}: {
  seasons: Season[];
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 p-1 rounded-full card">
      {seasons.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s.id)}
          className={`px-3 py-1.5 rounded-full text-sm font-semibold transition ${
            s.id === active
              ? "bg-white/90 text-slate-900"
              : "text-mut hover:text-slate-200"
          }`}
          title={s.name}
        >
          <span className="mr-1">{s.emoji}</span>
          <span className="hidden sm:inline">{s.shortName}</span>
          <span className="sm:hidden">{s.start.slice(2, 4)}</span>
        </button>
      ))}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: "lime" | "cyan" | "rose" | "amber";
}) {
  const color = {
    lime: "#b6f400",
    cyan: "#38e1d6",
    rose: "#ff5d6c",
    amber: "#ffb020",
  }[accent];
  return (
    <div className="card p-4 fadeup">
      <div className="text-mut text-xs uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-extrabold tnum mt-1" style={{ color }}>
        {value}
      </div>
      {sub && <div className="text-mut text-xs mt-0.5 tnum">{sub}</div>}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full grid place-items-center text-mut p-8 text-center">
      {children}
    </div>
  );
}
