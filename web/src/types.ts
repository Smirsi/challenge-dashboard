export type Status = "sicher" | "knapp" | "gefahr" | "ausgeschieden";

export interface SeriesPoint {
  date: string;
  score: number;
}

export interface Participant {
  name: string;
  score: number;
  firstDate: string;
  lastDate: string;
  daysInactive: number;
  status: Status;
  left: boolean;
  inactive: boolean;
  series: SeriesPoint[];
  pace: number;
  projected: number;
  neededPerDay: number;
  reachesGoal: boolean;
  posts: number;
  rank: number;
  delta: number;
}

export interface CurvePoint {
  date: string;
  soll: number;
  kick: number;
}

export interface Stats {
  biggestJump?: { name: string; value: number; date?: string };
  nightOwl?: { name: string | null; count: number };
  mostPosts?: { name: string; count: number };
  totalParticipants?: number;
  kicked?: number;
  leader?: string;
}

export interface Season {
  id: string;
  name: string;
  shortName: string;
  unit: string;
  emoji: string;
  start: string;
  end: string;
  goal: number;
  asOf: string;
  currentSoll: number;
  currentKickLimit: number;
  nextKickDate: string | null;
  nextKickLimit: number | null;
  kickDates: string[];
  participants: Participant[];
  curve: CurvePoint[];
  stats: Stats;
  champion: string | null;
}

export interface Data {
  generatedAt: string;
  asOf: string;
  seasons: Season[];
}
