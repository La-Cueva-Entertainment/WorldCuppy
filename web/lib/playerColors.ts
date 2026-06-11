export const PLAYER_COLORS = [
  { bg: "bg-emerald-50", ring: "ring-emerald-300", text: "text-emerald-700", dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-800" },
  { bg: "bg-amber-50",   ring: "ring-amber-300",   text: "text-amber-700",   dot: "bg-amber-500",   badge: "bg-amber-100 text-amber-800" },
  { bg: "bg-sky-50",     ring: "ring-sky-300",     text: "text-sky-700",     dot: "bg-sky-500",     badge: "bg-sky-100 text-sky-800" },
  { bg: "bg-rose-50",    ring: "ring-rose-300",    text: "text-rose-700",    dot: "bg-rose-500",    badge: "bg-rose-100 text-rose-800" },
  { bg: "bg-purple-50",  ring: "ring-purple-300",  text: "text-purple-700",  dot: "bg-purple-500",  badge: "bg-purple-100 text-purple-800" },
  { bg: "bg-orange-50",  ring: "ring-orange-300",  text: "text-orange-700",  dot: "bg-orange-500",  badge: "bg-orange-100 text-orange-800" },
  { bg: "bg-cyan-50",    ring: "ring-cyan-300",    text: "text-cyan-700",    dot: "bg-cyan-500",    badge: "bg-cyan-100 text-cyan-800" },
  { bg: "bg-fuchsia-50", ring: "ring-fuchsia-300", text: "text-fuchsia-700", dot: "bg-fuchsia-500", badge: "bg-fuchsia-100 text-fuchsia-800" },
] as const;

export function colorFor(idx: number) {
  return PLAYER_COLORS[idx % PLAYER_COLORS.length];
}
