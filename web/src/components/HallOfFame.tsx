import { useMemo } from "react";
import type { Data, Participant, Season } from "../types";
import { fmt, medal } from "../lib/format";

// "Geschafft" = Ziel erreicht (auch in der laufenden Saison schon möglich).
const reachedGoal = (p: Participant, s: Season) => p.score >= s.goal;

function champTitle(n: number): string | null {
  if (n >= 4) return `${n}-fach Champion`;
  if (n === 3) return "Triple Champion";
  if (n === 2) return "Double Champion";
  return null;
}

export default function HallOfFame({
  data,
  onJump,
}: {
  data: Data;
  onJump: (id: string) => void;
}) {
  // Champions-Ranking: wie viele Challenges hat wer geschafft (Ziel erreicht),
  // über ALLE Saisons inkl. der laufenden.
  const ranking = useMemo(() => {
    const map = new Map<string, { count: number; emojis: string[] }>();
    for (const s of data.seasons) {
      for (const p of s.participants) {
        if (!reachedGoal(p, s)) continue;
        const e = map.get(p.name) ?? { count: 0, emojis: [] };
        e.count += 1;
        e.emojis.push(s.emoji);
        map.set(p.name, e);
      }
    }
    return [...map.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [data]);

  return (
    <section className="mt-12">
      <h2 className="text-xl font-bold mb-3">🏆 Hall of Fame</h2>

      {/* Champions-Ranking über alle Challenges */}
      {ranking.length > 0 && (
        <div className="card p-4 sm:p-5 mb-4">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-bold">Meiste abgeschlossene Challenges</h3>
            <span className="text-mut text-xs">{data.seasons.length} Saisons gewertet</span>
          </div>
          <ol className="divide-y divide-white/5">
            {ranking.map((r, i) => {
              const title = champTitle(r.count);
              return (
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
                    {title && <span className="ml-2 text-xs text-amber-300">{title}</span>}
                  </span>
                  <span className="shrink-0 text-sm">
                    {r.emojis.map((e, k) => (
                      <span key={k} className="ml-0.5">
                        {e}
                      </span>
                    ))}
                  </span>
                  <span className="w-8 text-right font-extrabold tnum shrink-0">{r.count}×</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Pro Saison: alle Finisher (Ziel erreicht), oben angeheftet */}
      <div className="grid sm:grid-cols-3 gap-3 items-start">
        {data.seasons.map((s) => {
          const over = data.asOf >= s.end;
          const finishers = s.participants
            .filter((p) => reachedGoal(p, s))
            .sort((a, b) => b.score - a.score);
          const leader = s.participants[0];
          return (
            <button
              key={s.id}
              onClick={() => onJump(s.id)}
              className="card p-5 text-left hover:bg-white/[0.04] transition w-full"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">{s.emoji}</span>
                <span className="text-mut text-xs">
                  {s.start.slice(0, 4)}/{s.end.slice(2, 4)}
                  {!over && " · läuft"}
                </span>
              </div>
              <div className="font-bold mt-2">{s.name}</div>
              <div className="text-mut text-xs mb-3">
                Ziel {fmt(s.goal)} {s.unit} · {finishers.length} geschafft
              </div>

              {finishers.length > 0 ? (
                <ol className="space-y-1">
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
                <div className="text-mut text-sm">
                  {over ? (
                    "Niemand hat das Ziel erreicht."
                  ) : (
                    <>
                      noch niemand am Ziel · Führend:{" "}
                      <span className="text-slate-200 font-medium">{leader?.name ?? "—"}</span>
                    </>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
