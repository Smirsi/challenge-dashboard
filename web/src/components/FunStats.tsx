import type { Season } from "../types";
import { fmt, fmtDate } from "../lib/format";

export default function FunStats({ season }: { season: Season }) {
  const s = season.stats;
  const cards = [
    s.leader && { icon: "👑", label: "Führt", value: s.leader, sub: `${fmt(season.participants[0]?.score ?? 0)} ${season.unit}` },
    s.biggestJump?.name && {
      icon: "🚀",
      label: "Größter Sprung",
      value: s.biggestJump.name,
      sub: `+${fmt(s.biggestJump.value)}${s.biggestJump.date ? " · " + fmtDate(s.biggestJump.date) : ""}`,
    },
    s.mostPosts?.name && {
      icon: "📣",
      label: "Fleißigster Poster",
      value: s.mostPosts.name,
      sub: `${s.mostPosts.count} Einträge`,
    },
    s.nightOwl?.name && {
      icon: "🦉",
      label: "Nachteule",
      value: s.nightOwl.name,
      sub: `${s.nightOwl.count}× spät/nachts`,
    },
    typeof s.totalParticipants === "number" && {
      icon: "👥",
      label: "Teilnehmer gesamt",
      value: String(s.totalParticipants),
      sub: `${s.kicked ?? 0} gefährdet/raus`,
    },
  ].filter(Boolean) as { icon: string; label: string; value: string; sub: string }[];

  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold mb-3">Fun-Stats</h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((c, i) => (
          <div key={i} className="card p-4 fadeup" style={{ animationDelay: `${i * 40}ms` }}>
            <div className="text-2xl">{c.icon}</div>
            <div className="text-mut text-xs uppercase tracking-wide mt-1">{c.label}</div>
            <div className="font-bold text-lg truncate">{c.value}</div>
            <div className="text-mut text-sm tnum">{c.sub}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
