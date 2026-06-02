import type { Data } from "../types";
import { fmt } from "../lib/format";

export default function HallOfFame({
  data,
  onJump,
}: {
  data: Data;
  onJump: (id: string) => void;
}) {
  return (
    <section className="mt-12">
      <h2 className="text-xl font-bold mb-3">🏆 Hall of Fame</h2>
      <div className="grid sm:grid-cols-3 gap-3">
        {data.seasons.map((s) => {
          const podium = s.participants
            .filter((p) => p.status !== "ausgeschieden")
            .slice(0, 3);
          return (
            <button
              key={s.id}
              onClick={() => onJump(s.id)}
              className="card p-5 text-left hover:bg-white/[0.04] transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">{s.emoji}</span>
                <span className="text-mut text-xs">{s.start.slice(0, 4)}/{s.end.slice(2, 4)}</span>
              </div>
              <div className="font-bold mt-2">{s.name}</div>
              <div className="text-mut text-xs mb-3">
                Ziel {fmt(s.goal)} {s.unit}
              </div>
              <ol className="space-y-1.5">
                {podium.map((p, i) => (
                  <li key={p.name} className="flex items-center gap-2 text-sm">
                    <span>{["🥇", "🥈", "🥉"][i]}</span>
                    <span className="flex-1 truncate font-medium">{p.name}</span>
                    <span className="tnum text-mut">{fmt(p.score)}</span>
                  </li>
                ))}
              </ol>
            </button>
          );
        })}
      </div>
    </section>
  );
}
