import { useMemo, useState } from "react";
import type { Season, Participant } from "../types";
import { fmt, fmtDate, STATUS_META, medal } from "../lib/format";

type Filter = "alle" | "aktiv" | "gefahr";

export default function Leaderboard({ season }: { season: Season }) {
  const [filter, setFilter] = useState<Filter>("aktiv");
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => {
    let r = season.participants;
    if (filter === "aktiv") r = r.filter((p) => p.status !== "ausgeschieden");
    if (filter === "gefahr") r = r.filter((p) => p.status === "gefahr" || p.status === "knapp");
    return r;
  }, [season, filter]);

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold">Rangliste</h2>
        <div className="flex gap-1 p-1 rounded-full card text-sm">
          {(["aktiv", "alle", "gefahr"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full font-semibold transition ${
                filter === f ? "bg-white/90 text-slate-900" : "text-mut hover:text-slate-200"
              }`}
            >
              {f === "aktiv" ? "Aktive" : f === "alle" ? "Alle" : "🟡🔴 Gefährdet"}
            </button>
          ))}
        </div>
      </div>

      <div className="card divide-y divide-white/5 overflow-hidden">
        {rows.map((p, i) => (
          <Row
            key={p.name}
            p={p}
            season={season}
            index={i}
            open={open === p.name}
            onToggle={() => setOpen(open === p.name ? null : p.name)}
          />
        ))}
        {rows.length === 0 && (
          <div className="p-6 text-center text-mut">Niemand in dieser Ansicht.</div>
        )}
      </div>
    </section>
  );
}

function Row({
  p,
  season,
  index,
  open,
  onToggle,
}: {
  p: Participant;
  season: Season;
  index: number;
  open: boolean;
  onToggle: () => void;
}) {
  const meta = STATUS_META[p.status];
  const pct = Math.min(100, (p.score / season.goal) * 100);
  const sollPct = Math.min(100, (season.currentSoll / season.goal) * 100);

  return (
    <div
      className="px-3 sm:px-4 py-3 hover:bg-white/[0.03] transition cursor-pointer fadeup"
      style={{ animationDelay: `${Math.min(index, 15) * 25}ms` }}
      onClick={onToggle}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 text-center font-bold tnum text-mut shrink-0">
          {medal(p.rank) || p.rank}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate">{p.name}</span>
            {p.inactive && p.status !== "ausgeschieden" && (
              <span title={`${p.daysInactive} Tage inaktiv`} className="text-amber-300 text-xs">
                ⏳
              </span>
            )}
          </div>
          {/* Progress-Bar mit Soll-Marker */}
          <div className="relative h-2 mt-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className="bar-fill h-full rounded-full"
              style={{
                width: `${pct}%`,
                background:
                  p.status === "gefahr"
                    ? "linear-gradient(90deg,#ff5d6c,#ff8f7a)"
                    : p.status === "knapp"
                    ? "linear-gradient(90deg,#ffb020,#ffd166)"
                    : p.status === "ausgeschieden"
                    ? "#3a4452"
                    : "linear-gradient(90deg,#b6f400,#38e1d6)",
              }}
            />
            {/* Soll-Marker */}
            <div
              className="absolute top-[-2px] bottom-[-2px] w-px bg-white/60"
              style={{ left: `${sollPct}%` }}
              title={`Soll: ${fmt(season.currentSoll)}`}
            />
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="font-extrabold tnum text-lg leading-none">{fmt(p.score)}</div>
          <div
            className="text-xs tnum mt-0.5"
            style={{ color: p.delta >= 0 ? "#b6f400" : "#ff97a1" }}
          >
            {p.delta >= 0 ? "+" : ""}
            {fmt(p.delta)} z. Soll
          </div>
        </div>

        <span
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0"
          style={{ background: meta.bg, color: meta.text }}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: meta.dot }} />
          {meta.label}
        </span>
      </div>

      {open && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-white/5 text-sm">
          <Detail label="Status" value={meta.label} color={meta.text} />
          <Detail label="Tempo" value={`${p.pace}/Tag`} />
          <Detail
            label="Hochrechnung"
            value={fmt(p.projected)}
            color={p.reachesGoal ? "#b6f400" : "#ff97a1"}
            sub={p.reachesGoal ? "Ziel erreichbar 🎯" : "unter Ziel"}
          />
          <Detail label="Nötig/Tag (Ziel)" value={`${p.neededPerDay}`} />
          <Detail label="Erster Post" value={fmtDate(p.firstDate)} />
          <Detail label="Letzter Post" value={fmtDate(p.lastDate)} sub={`${p.daysInactive} T her`} />
          {p.kickedDate && (
            <Detail label="Gekickt am" value={fmtDate(p.kickedDate)} color="#ff97a1" />
          )}
          <Detail label="Posts" value={`${p.posts}`} />
          <Detail
            label="Kickgrenze nächste"
            value={fmt(season.nextKickLimit ?? season.currentKickLimit)}
          />
        </div>
      )}
    </div>
  );
}

function Detail({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div>
      <div className="text-mut text-xs uppercase tracking-wide">{label}</div>
      <div className="font-semibold tnum" style={color ? { color } : undefined}>
        {value}
      </div>
      {sub && <div className="text-mut text-xs">{sub}</div>}
    </div>
  );
}
