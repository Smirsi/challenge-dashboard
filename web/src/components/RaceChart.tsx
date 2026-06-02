import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { Season } from "../types";
import { fmt, fmtDate, LINE_COLORS } from "../lib/format";

export default function RaceChart({ season }: { season: Season }) {
  // Standard: Top 5 aktive Teilnehmer
  const topActive = useMemo(
    () => season.participants.filter((p) => p.status !== "ausgeschieden").slice(0, 5),
    [season]
  );
  const selectable = useMemo(() => season.participants.slice(0, 30), [season]);
  const [selected, setSelected] = useState<string[]>(topActive.map((p) => p.name));

  const data = useMemo(() => buildChartData(season, selected), [season, selected]);

  const toggle = (name: string) =>
    setSelected((s) => (s.includes(name) ? s.filter((n) => n !== name) : [...s, name]));

  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold mb-1">Verlauf</h2>
      <p className="text-mut text-sm mb-3">
        Punkte über Zeit. Gestrichelt: <span className="text-slate-200">Soll</span> und{" "}
        <span style={{ color: "#ff8f9a" }}>Kickgrenze</span>.
      </p>

      <div className="card p-3 sm:p-4">
        <div className="h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid stroke="#ffffff10" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={fmtDate}
                stroke="#5b6675"
                fontSize={11}
                minTickGap={40}
              />
              <YAxis
                stroke="#5b6675"
                fontSize={11}
                tickFormatter={(v) => fmt(v)}
                width={56}
              />
              <Tooltip
                contentStyle={{
                  background: "#11161f",
                  border: "1px solid #232c3a",
                  borderRadius: 12,
                  fontSize: 13,
                }}
                labelFormatter={(l) => fmtDate(String(l))}
                formatter={(v: number, n: string) => [fmt(v), n]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />

              <Line
                dataKey="Soll"
                stroke="#e7edf4"
                strokeDasharray="5 4"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                dataKey="Kickgrenze"
                stroke="#ff5d6c"
                strokeDasharray="5 4"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
              {selected.map((name, i) => (
                <Line
                  key={name}
                  dataKey={name}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  strokeWidth={2.4}
                  dot={false}
                  connectNulls
                  isAnimationActive={true}
                  animationDuration={700}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Auswahl-Chips */}
        <div className="flex flex-wrap gap-1.5 mt-4">
          {selectable.map((p, i) => {
            const on = selected.includes(p.name);
            const color = LINE_COLORS[selected.indexOf(p.name) % LINE_COLORS.length];
            return (
              <button
                key={p.name}
                onClick={() => toggle(p.name)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition ${
                  on ? "text-slate-900" : "text-mut border-white/10 hover:text-slate-200"
                }`}
                style={
                  on
                    ? { background: color, borderColor: color }
                    : undefined
                }
                title={`${p.name} · ${fmt(p.score)}`}
              >
                {p.name}
                <span className="opacity-60 ml-1">{i + 1}.</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function buildChartData(season: Season, selected: string[]) {
  const dates = season.curve.map((c) => c.date);
  const byName = new Map(season.participants.map((p) => [p.name, p.series]));

  return dates.map((date, idx) => {
    const c = season.curve[idx];
    const row: Record<string, number | string | null> = {
      date,
      Soll: c.soll,
      Kickgrenze: c.kick,
    };
    for (const name of selected) {
      const series = byName.get(name) ?? [];
      // letzter Stand mit Datum <= aktuellem Kurvendatum
      let val: number | null = null;
      for (const pt of series) {
        if (pt.date <= date) val = pt.score;
        else break;
      }
      row[name] = val;
    }
    return row;
  });
}
