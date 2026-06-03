import { useMemo } from "react";
import type { Data } from "../types";
import { fmt, medal } from "../lib/format";

export default function HallOfFame({
  data,
  onJump,
}: {
  data: Data;
  onJump: (id: string) => void;
}) {
  // Abgeschlossene Saisons (Enddatum erreicht)
  const finishedSeasons = data.seasons.filter((s) => data.asOf >= s.end);

  // Champions-Ranking: wie viele Challenges hat wer abgeschlossen (Status "geschafft")
  const ranking = useMemo(() => {
    const map = new Map<
      string,
      { count: number; seasons: { emoji: string; shortName: string; id: string; score: number }[] }
    >();
    for (const s of finishedSeasons) {
      for (const p of s.participants) {
        if (p.status !== "geschafft") continue;
        const e = map.get(p.name) ?? { count: 0, seasons: [] };
        e.count += 1;
        e.seasons.push({ emoji: s.emoji, shortName: s.shortName, id: s.id, score: p.score });
        map.set(p.name, e);
      }
    }
    return [...map.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.count - a.count || b.seasons.length - a.seasons.length || a.name.localeCompare(b.name));
  }, [finishedSeasons]);

  const maxCount = ranking[0]?.count ?? 0;

  return (
    <section className="mt-12">
      <h2 className="text-xl font-bold mb-3">🏆 Hall of Fame</h2>

      {/* Champions-Ranking über alle Challenges */}
      {ranking.length > 0 && (
        <div className="card p-4 sm:p-5 mb-4">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-bold">Meiste abgeschlossene Challenges</h3>
            <span className="text-mut text-xs">{finishedSeasons.length} Saisons gewertet</span>
          </div>
          <ol className="divide-y divide-white/5">
            {ranking.map((r, i) => (
              <li
                key={r.name}
                className="flex items-center gap-3 py-2 fadeup"
                style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
              >
                <span className="w-7 text-center text-mut font-bold tnum shrink-0">{i + 1}</span>
                <span className="text-base leading-none shrink-0" title={`${r.count}× geschafft`}>
                  {"🏆".repeat(r.count)}
                </span>
                <span className="flex-1 min-w-0 font-semibold truncate">
                  {r.name}
                  {r.count === maxCount && maxCount > 1 && (
                    <span className="ml-2 text-xs text-amber-300">
                      {r.count >= 3 ? "Triple Champion" : "Double Champion"}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-sm">
                  {r.seasons.map((s) => (
                    <span key={s.id} title={s.shortName} className="ml-0.5">
                      {s.emoji}
                    </span>
                  ))}
                </span>
                <span className="w-8 text-right font-extrabold tnum shrink-0">{r.count}×</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Pro Saison: alle Finisher */}
      <div className="grid sm:grid-cols-3 gap-3">
        {data.seasons.map((s) => {
          const over = data.asOf >= s.end;
          const finishers = s.participants
            .filter((p) => p.status === "geschafft")
            .sort((a, b) => b.score - a.score);
          const leader = s.participants[0];
          return (
            <button
              key={s.id}
              onClick={() => onJump(s.id)}
              className="card p-5 text-left hover:bg-white/[0.04] transition flex flex-col"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">{s.emoji}</span>
                <span className="text-mut text-xs">
                  {s.start.slice(0, 4)}/{s.end.slice(2, 4)}
                </span>
              </div>
              <div className="font-bold mt-2">{s.name}</div>
              <div className="text-mut text-xs mb-3">
                Ziel {fmt(s.goal)} {s.unit}
                {over && ` · ${finishers.length} geschafft`}
              </div>

              {over ? (
                finishers.length > 0 ? (
                  <ol className="space-y-1 mt-auto">
                    {finishers.map((p, i) => (
                      <li key={p.name} className="flex items-center gap-2 text-sm">
                        <span className="w-5 text-center shrink-0">
                          {medal(i + 1) || <span className="text-mut">{i + 1}.</span>}
                        </span>
                        <span className="flex-1 truncate font-medium">{p.name}</span>
                        <span className="tnum text-mut">{fmt(p.score)}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="text-mut text-sm mt-auto">Niemand hat das Ziel erreicht.</div>
                )
              ) : (
                <div className="text-mut text-sm mt-auto">
                  läuft noch · Führend:{" "}
                  <span className="text-slate-200 font-medium">{leader?.name ?? "—"}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
