// SP — photo-free avatar: initials on a celestial gradient chosen deterministically from the name.
const GRADIENTS: [string, string][] = [
  ["#7c5cff", "#ff8fb1"],
  ["#e8a33d", "#7c5cff"],
  ["#ff8fb1", "#a78bff"],
  ["#a78bff", "#e8a33d"],
  ["#7c5cff", "#2d1b4e"],
  ["#e8a33d", "#ff8fb1"],
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function MonogramAvatar({ name, size = 52 }: { name: string; size?: number }) {
  const [a, b] = GRADIENTS[hash(name) % GRADIENTS.length];
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-clash font-semibold text-cosmos"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg, ${a}, ${b})` }}
    >
      {initials(name)}
    </span>
  );
}
