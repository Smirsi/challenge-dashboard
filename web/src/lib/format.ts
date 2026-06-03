import type { Status } from "../types";

export const nf = new Intl.NumberFormat("de-DE");

export function fmt(n: number): string {
  return nf.format(Math.round(n));
}

export function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function daysUntil(iso: string | null, from: string): number | null {
  if (!iso) return null;
  const a = new Date(iso + "T00:00:00").getTime();
  const b = new Date(from + "T00:00:00").getTime();
  return Math.round((a - b) / 86400000);
}

export const STATUS_META: Record<Status, { label: string; dot: string; text: string; bg: string }> = {
  geschafft: { label: "Geschafft 🏆", dot: "#ffd166", text: "#ffe39a", bg: "rgba(255,209,102,0.14)" },
  sicher: { label: "Sicher", dot: "#b6f400", text: "#cde96a", bg: "rgba(182,244,0,0.12)" },
  knapp: { label: "Knapp", dot: "#ffb020", text: "#ffcf72", bg: "rgba(255,176,32,0.12)" },
  gefahr: { label: "Kick-Zone", dot: "#ff5d6c", text: "#ff97a1", bg: "rgba(255,93,108,0.14)" },
  ausgeschieden: { label: "Ausgeschieden", dot: "#5b6675", text: "#8a97a8", bg: "rgba(138,151,168,0.10)" },
};

// Farbpalette fuer Chart-Linien
export const LINE_COLORS = [
  "#b6f400", "#38e1d6", "#ffb020", "#ff5d6c", "#8b7bff",
  "#5ad1ff", "#ff8fcf", "#7CFFB2", "#ffd166", "#c792ea",
];

export function medal(rank: number): string {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "";
}
