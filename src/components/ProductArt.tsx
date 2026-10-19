// Flat illustrations for the demo products, so the shop doesn't need stock photos.

const BG: Record<string, string> = {
  "mug-set": "#f3e3d3",
  "pour-over": "#dfe9ef",
  "table-lamp": "#ece6f5",
};

export function ProductArt({ sku, className }: { sku: string; className?: string }) {
  return (
    <svg viewBox="0 0 200 150" className={className} role="img" aria-hidden>
      <rect width="200" height="150" fill={BG[sku] ?? "#eee"} />
      <ellipse cx="100" cy="128" rx="70" ry="7" fill="#000" opacity="0.06" />
      {sku === "mug-set" && <Mugs />}
      {sku === "pour-over" && <Kettle />}
      {sku === "table-lamp" && <Lamp />}
    </svg>
  );
}

function Mugs() {
  const mug = (x: number, y: number, s: number, body: string, glaze: string) => (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M38 14 q14 0 14 14 t-14 14" fill="none" stroke={body} strokeWidth="6" />
      <rect x="0" y="0" width="40" height="50" rx="6" fill={body} />
      <rect x="0" y="0" width="40" height="16" rx="6" fill={glaze} />
      <rect x="0" y="10" width="40" height="6" fill={glaze} />
      <ellipse cx="20" cy="2" rx="18" ry="3" fill="#000" opacity="0.12" />
    </g>
  );
  return (
    <>
      {mug(38, 62, 1, "#c9744b", "#7b3f26")}
      {mug(90, 52, 1.15, "#e8d6c0", "#2f4bff")}
      {mug(146, 70, 0.85, "#556b5d", "#2b3a31")}
    </>
  );
}

function Kettle() {
  return (
    <g>
      <path d="M70 120 q-6 -52 30 -56 q36 4 30 56 z" fill="#ffffff" opacity="0.65" stroke="#8fb1c4" strokeWidth="2" />
      <path d="M74 112 q-2 -26 26 -30 q28 4 26 30 z" fill="#c7a17a" opacity="0.55" />
      <rect x="86" y="54" width="28" height="12" rx="3" fill="#2c3440" />
      <rect x="96" y="46" width="8" height="10" rx="3" fill="#2c3440" />
      <path d="M128 90 q24 -6 30 -34" fill="none" stroke="#8fb1c4" strokeWidth="5" strokeLinecap="round" />
      <path d="M70 80 q-22 6 -16 30" fill="none" stroke="#2c3440" strokeWidth="6" strokeLinecap="round" />
    </g>
  );
}

function Lamp() {
  return (
    <g>
      <path d="M68 30 h64 l14 40 h-92 z" fill="#f7f1e6" stroke="#d9cdb8" strokeWidth="2" />
      <rect x="98" y="70" width="4" height="14" fill="#9a8f7e" />
      <path d="M78 122 q-6 -38 22 -40 q28 2 22 40 z" fill="#ffffff" stroke="#d8d2e4" strokeWidth="2" />
      <ellipse cx="100" cy="122" rx="24" ry="4" fill="#d8d2e4" />
      <circle cx="100" cy="76" r="26" fill="#ffd66b" opacity="0.18" />
    </g>
  );
}
