// Shared look and motion for the video: the app's tokens, spring helpers, a browser frame with a
// camera, a cursor, the illustrated "photo" of the chipped mug, captions and headings.

import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

export const C = {
  paper: "#f6f4ef",
  surface: "#ffffff",
  ink: "#15171c",
  muted: "#5d6270",
  faint: "#8d92a0",
  line: "#e7e3da",
  brand: "#2f4bff",
  brandInk: "#1b2fc4",
  brandSoft: "#eceffe",
  good: "#11865a",
  goodSoft: "#e3f5ec",
  warn: "#a35d00",
  warnSoft: "#fdf1dc",
  bad: "#c42b35",
  badSoft: "#fde8e9",
};

export const SANS = '"Geist Variable", system-ui, sans-serif';
export const MONO = '"Geist Mono Variable", ui-monospace, monospace';

export const ease = Easing.bezier(0.45, 0, 0.2, 1);
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

/** 0→1 spring starting at `at` (local frame). */
export function useIn(at: number, config: { damping?: number; stiffness?: number; mass?: number } = {}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - at, fps, config: { damping: 18, stiffness: 120, mass: 0.9, ...config } });
}

/** Linear 0→1 between two local frames, eased. */
export function useRamp(from: number, to: number, easing = ease) {
  const frame = useCurrentFrame();
  return interpolate(frame, [from, to], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
}

/** Fade + rise style for an element entering at `at`. */
export function useRise(at: number, distance = 28): CSSProperties {
  const p = useIn(at, { damping: 20, stiffness: 110 });
  return { opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * distance}px)` };
}

/** Scene shell: fades in and out at its edges so cuts between scenes stay soft. */
export function SceneShell({ duration, children }: { duration: number; children: ReactNode }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 9, duration - 9, duration], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scale = interpolate(frame, [0, 12, duration - 10, duration], [1.015, 1, 1, 0.99], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  return <AbsoluteFill style={{ opacity, transform: `scale(${scale})` }}>{children}</AbsoluteFill>;
}

/** Paper background with a soft drifting glow, shared by every scene. */
export function Backdrop() {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const x1 = 70 + Math.sin(t / 9) * 8;
  const y1 = 18 + Math.cos(t / 11) * 6;
  const x2 = 18 + Math.cos(t / 13) * 7;
  const y2 = 88 + Math.sin(t / 10) * 5;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(900px 700px at ${x1}% ${y1}%, rgba(47,75,255,0.075), transparent 70%),
          radial-gradient(800px 600px at ${x2}% ${y2}%, rgba(243,180,120,0.12), transparent 70%), ${C.paper}`,
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage: "radial-gradient(rgba(21,23,28,0.07) 1.2px, transparent 1.2px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 85%)",
        }}
      />
    </AbsoluteFill>
  );
}

export function LogoMark({ size = 48, draw = 1 }: { size?: number; draw?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}>
      <rect width="24" height="24" rx="7" fill={C.brand} />
      <path
        d="M15.5 8.5 10 14a1.6 1.6 0 0 1-2.3-2.3l6-6a2.8 2.8 0 0 1 4 4l-6.3 6.3a4 4 0 0 1-5.7-5.7l5.6-5.6"
        fill="none"
        stroke="white"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(0.5 1.5) scale(0.92)"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - draw}
      />
    </svg>
  );
}

/** Small uppercase label above a heading. */
export function Kicker({ children, at = 0, color = C.brand }: { children: ReactNode; at?: number; color?: string }) {
  const style = useRise(at, 16);
  return (
    <div style={{ ...style, fontFamily: SANS, fontSize: 22, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color }}>
      {children}
    </div>
  );
}

/** A heading whose words rise in one after another. */
export function Words({
  text,
  at = 0,
  stagger = 2.2,
  style,
  highlight = {},
}: {
  text: string;
  at?: number;
  stagger?: number;
  style?: CSSProperties;
  highlight?: Record<string, string>;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  return (
    <div style={{ fontFamily: SANS, color: C.ink, ...style }}>
      {words.map((w, i) => {
        const p = spring({ frame: frame - at - i * stagger, fps, config: { damping: 18, stiffness: 140 } });
        const key = w.replace(/[.,!?]/g, "");
        return (
          <span key={i} style={{ display: "inline-block", whiteSpace: "pre" }}>
            <span
              style={{
                display: "inline-block",
                opacity: Math.min(1, p * 1.5),
                transform: `translateY(${(1 - p) * 0.45}em)`,
                filter: `blur(${(1 - Math.min(1, p)) * 6}px)`,
                color: highlight[key] ?? undefined,
              }}
            >
              {w}
            </span>
            {i < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </div>
  );
}

/** A row with an icon dot and text that rises in at `at`. */
export function Point({ at, children, icon = "check", tone = C.brand }: { at: number; children: ReactNode; icon?: string; tone?: string }) {
  const style = useRise(at, 20);
  const p = useIn(at + 3, { damping: 12, stiffness: 180 });
  return (
    <div style={{ ...style, display: "flex", alignItems: "flex-start", gap: 18, fontFamily: SANS, fontSize: 32, lineHeight: 1.3, color: C.ink }}>
      <div
        style={{
          flex: "none",
          marginTop: 4,
          width: 36,
          height: 36,
          borderRadius: 12,
          background: tone === C.brand ? C.brandSoft : tone === C.good ? C.goodSoft : tone === C.warn ? C.warnSoft : C.badSoft,
          display: "grid",
          placeItems: "center",
          transform: `scale(${p})`,
        }}
      >
        <Icon name={icon} color={tone} size={20} />
      </div>
      <div>{children}</div>
    </div>
  );
}

export function Icon({ name, color = C.ink, size = 24, stroke = 2 }: { name: string; color?: string; size?: number; stroke?: number }) {
  const p = {
    fill: "none",
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const paths: Record<string, ReactNode> = {
    check: <path d="M5 12.5 10 17 19 7.5" {...p} />,
    dot: <circle cx="12" cy="12" r="4" fill={color} />,
    arrow: <path d="M5 12h14M13 6l6 6-6 6" {...p} />,
    camera: (
      <>
        <path d="M4 8h3l2-3h6l2 3h3v11H4z" {...p} />
        <circle cx="12" cy="13" r="3.5" {...p} />
      </>
    ),
    tag: (
      <>
        <path d="M3 12V4h8l10 10-8 8z" {...p} />
        <circle cx="7.5" cy="8" r="1.5" {...p} />
      </>
    ),
    pin: (
      <>
        <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" {...p} />
        <circle cx="12" cy="9.5" r="2.5" {...p} />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" {...p} />
        <path d="M12 7v5l3 2" {...p} />
      </>
    ),
    box: (
      <>
        <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" {...p} />
        <path d="M3 7.5 12 12l9-4.5M12 12v9" {...p} />
      </>
    ),
    heart: <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" {...p} />,
    refund: (
      <>
        <path d="M4 9h12a4 4 0 0 1 0 8H9" {...p} />
        <path d="M8 5 4 9l4 4" {...p} />
      </>
    ),
    keep: (
      <>
        <path d="M4 10.5 12 4l8 6.5V20H4z" {...p} />
        <path d="M9.5 20v-5.5h5V20" {...p} />
      </>
    ),
    noship: (
      <>
        <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" {...p} />
        <path d="M4 4l16 16" {...p} />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6z" {...p} />
        <path d="m8.5 12 2.5 2.5 4.5-5" {...p} />
      </>
    ),
    spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" {...p} />,
    user: (
      <>
        <circle cx="12" cy="8" r="3.5" {...p} />
        <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" {...p} />
      </>
    ),
    bolt: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" {...p} />,
    down: <path d="M12 5v14M6 13l6 6 6-6" {...p} />,
    retry: (
      <>
        <path d="M20 11a8 8 0 1 0-2.3 5.7" {...p} />
        <path d="M20 4v7h-7" {...p} />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ display: "block", flex: "none" }}>
      {paths[name]}
    </svg>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: C.surface,
        borderRadius: 28,
        border: `1px solid ${C.line}`,
        boxShadow: "0 1px 2px rgba(21,23,28,0.04), 0 18px 50px -18px rgba(21,23,28,0.18)",
        fontFamily: SANS,
        color: C.ink,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Pill({ children, tone = "brand", size = 22, style }: { children: ReactNode; tone?: "brand" | "good" | "warn" | "bad" | "ink" | "muted"; size?: number; style?: CSSProperties }) {
  const tones = {
    brand: [C.brandSoft, C.brandInk],
    good: [C.goodSoft, C.good],
    warn: [C.warnSoft, C.warn],
    bad: [C.badSoft, C.bad],
    ink: [C.ink, "#fff"],
    muted: ["#efece5", C.muted],
  }[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: size * 0.4,
        padding: `${size * 0.32}px ${size * 0.7}px`,
        borderRadius: 999,
        background: tones[0],
        color: tones[1],
        fontFamily: SANS,
        fontSize: size,
        fontWeight: 600,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export type CamKey = { at: number; z: number; x: number; y: number };

/** Interpolates camera keyframes (zoom and focus point in screen coordinates) with easing between holds. */
export function camAt(frame: number, keys: CamKey[], dur = 24): { z: number; x: number; y: number } {
  let cur = keys[0];
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (frame < k.at) break;
    const t = interpolate(frame, [k.at, k.at + dur], [0, 1], { extrapolateRight: "clamp", easing: ease });
    cur = { at: k.at, z: cur.z + (k.z - cur.z) * t, x: cur.x + (k.x - cur.x) * t, y: cur.y + (k.y - cur.y) * t };
  }
  return cur;
}

/**
 * A browser window showing app screenshots (captured at 1440 CSS px wide, 2×). Children are overlays
 * in the same screen coordinates, so they move with the camera.
 */
export function BrowserFrame({
  layers,
  width,
  viewH = 900,
  url,
  cam = { z: 1, x: 720, y: viewH / 2 },
  children,
  style,
}: {
  layers: { src: string; opacity?: number; h?: number }[];
  width: number;
  viewH?: number;
  url: string;
  cam?: { z: number; x: number; y: number };
  children?: ReactNode;
  style?: CSSProperties;
}) {
  const s = width / 1440;
  const W = 1440;
  const tx = Math.min(0, Math.max(W - W * cam.z, W / 2 - cam.x * cam.z));
  const ty = Math.min(0, Math.max(viewH - (layers[0].h ?? 900) * cam.z, viewH / 2 - cam.y * cam.z));
  return (
    <div
      style={{
        width,
        borderRadius: 22,
        overflow: "hidden",
        background: C.surface,
        border: `1px solid ${C.line}`,
        boxShadow: "0 2px 4px rgba(21,23,28,0.04), 0 40px 90px -30px rgba(21,23,28,0.35)",
        ...style,
      }}
    >
      <div style={{ height: 50, display: "flex", alignItems: "center", gap: 10, padding: "0 20px", borderBottom: `1px solid ${C.line}`, background: "#fbfaf7" }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <div key={c} style={{ width: 13, height: 13, borderRadius: 99, background: c, opacity: 0.85 }} />
        ))}
        <div
          style={{
            margin: "0 auto",
            padding: "7px 22px",
            borderRadius: 10,
            background: "#f0eee8",
            fontFamily: SANS,
            fontSize: 17,
            color: C.muted,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24">
            <path d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z" fill="none" stroke={C.faint} strokeWidth="2.4" strokeLinejoin="round" />
          </svg>
          {url}
        </div>
        <div style={{ width: 80 }} />
      </div>
      <div style={{ width, height: viewH * s, overflow: "hidden", position: "relative" }}>
        <div style={{ width: W, height: viewH, transform: `scale(${s})`, transformOrigin: "0 0", position: "absolute", left: 0, top: 0 }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: W, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${cam.z})` }}>
            {layers.map((l, i) => (
              <Img
                key={l.src}
                src={staticFile(l.src)}
                style={{ position: i ? "absolute" : "relative", left: 0, top: 0, width: W, display: "block", opacity: l.opacity ?? 1 }}
              />
            ))}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Where a screen-coordinate point lands inside a BrowserFrame's viewport (px from its top-left, below the bar). */
export function screenToFrame(cam: { z: number; x: number; y: number }, sx: number, sy: number, width: number, viewH = 900, contentH = 900) {
  const W = 1440;
  const s = width / W;
  const tx = Math.min(0, Math.max(W - W * cam.z, W / 2 - cam.x * cam.z));
  const ty = Math.min(0, Math.max(viewH - contentH * cam.z, viewH / 2 - cam.y * cam.z));
  return { x: (sx * cam.z + tx) * s, y: (sy * cam.z + ty) * s, scale: cam.z * s };
}

export type CursorKey = { at: number; x: number; y: number; click?: boolean };

/** Mouse cursor gliding between points (screen coordinates), with a ripple on clicks. */
export function Cursor({ keys, appear = 0 }: { keys: CursorKey[]; appear?: number }) {
  const frame = useCurrentFrame();
  let x = keys[0].x;
  let y = keys[0].y;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    const start = b.at - 18;
    if (frame <= start) break;
    const t = interpolate(frame, [start, b.at], [0, 1], { extrapolateRight: "clamp", easing: ease });
    x = a.x + (b.x - a.x) * t;
    y = a.y + (b.y - a.y) * t;
  }
  const clicks = keys.filter((k) => k.click);
  const press = clicks.reduce((m, k) => Math.max(m, interpolate(frame, [k.at, k.at + 3, k.at + 8], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })), 0);
  const opacity = interpolate(frame, [appear, appear + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <>
      {clicks.map((k) => {
        const r = interpolate(frame, [k.at, k.at + 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeOut });
        if (frame < k.at || r >= 1) return null;
        return (
          <div
            key={k.at}
            style={{
              position: "absolute",
              left: k.x - 40,
              top: k.y - 40,
              width: 80,
              height: 80,
              borderRadius: 99,
              border: `3px solid ${C.brand}`,
              transform: `scale(${0.2 + r})`,
              opacity: 1 - r,
            }}
          />
        );
      })}
      <svg
        width={34}
        height={40}
        viewBox="0 0 17 20"
        style={{ position: "absolute", left: x - 3, top: y - 2, opacity, transform: `scale(${1 - press * 0.15})`, transformOrigin: "3px 2px", filter: "drop-shadow(0 3px 5px rgba(0,0,0,0.3))" }}
      >
        <path d="M1.5 1.5v14.2l3.7-3.5 2.6 6 2.6-1.1-2.6-5.9h5.2z" fill={C.ink} stroke="white" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    </>
  );
}

/** Rounded highlight ring drawn around a rectangle (screen coordinates), with an optional label. */
export function Ring({ at, x, y, w, h, label, color = C.brand, labelSide = "top" }: { at: number; x: number; y: number; w: number; h: number; label?: string; color?: string; labelSide?: "top" | "bottom" }) {
  const p = useIn(at, { damping: 16, stiffness: 140 });
  const frame = useCurrentFrame();
  if (frame < at) return null;
  return (
    <div style={{ position: "absolute", left: x - 8, top: y - 8, width: w + 16, height: h + 16, opacity: Math.min(1, p * 1.5), transform: `scale(${1.15 - 0.15 * p})` }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 14, border: `3px solid ${color}`, boxShadow: `0 0 0 6px ${color}22` }} />
      {label && (
        <div
          style={{
            position: "absolute",
            left: 0,
            [labelSide === "top" ? "bottom" : "top"]: "100%",
            margin: "8px 0",
            padding: "4px 12px",
            borderRadius: 8,
            background: color,
            color: "#fff",
            fontFamily: SANS,
            fontSize: 18,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

/** Marker-pen glyphs for the claim code, so the paper looks handwritten. */
const GLYPHS: Record<string, string[]> = {
  "7": ["M6 9 Q30 5 52 7", "M52 7 Q36 40 22 76"],
  K: ["M12 6 Q10 42 11 76", "M50 8 Q30 26 13 45", "M22 37 Q38 56 54 75"],
  Q: ["M31 6 C10 7 5 30 7 45 C9 69 24 77 34 75 C53 72 57 47 54 30 C52 15 45 6 31 6", "M36 55 Q46 66 58 79"],
  "4": ["M41 76 Q40 40 43 6", "M43 6 Q22 33 5 52 Q30 50 59 49"],
};

export function Handwritten({ text, size = 60, color = "#1d1f24", draw = 1 }: { text: string; size?: number; color?: string; draw?: number }) {
  const chars = text.split("");
  return (
    <svg viewBox={`0 0 ${chars.length * 66} 84`} width={(chars.length * 66 * size) / 84} height={size} style={{ display: "block", overflow: "visible" }}>
      {chars.map((ch, i) => {
        const local = Math.max(0, Math.min(1, draw * chars.length - i));
        return (
          <g key={i} transform={`translate(${i * 66} ${[0, 3, -2, 2][i % 4]}) rotate(${[-3, 2, -1, 3][i % 4]} 30 40)`}>
            {(GLYPHS[ch] ?? []).map((d, j) => (
              <path key={j} d={d} fill="none" stroke={color} strokeWidth={8.5} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - local} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

/** The chipped stoneware mug, in the shop's flat illustration style but more detailed. */
export function Mug({ size = 400, chipGlow = 0 }: { size?: number; chipGlow?: number }) {
  return (
    <svg viewBox="0 0 400 400" width={size} height={size} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id="mugBody" x1="0" x2="1">
          <stop offset="0" stopColor="#efe2cf" />
          <stop offset="0.55" stopColor="#e6d4bb" />
          <stop offset="1" stopColor="#cdb495" />
        </linearGradient>
        <linearGradient id="mugGlaze" x1="0" x2="1">
          <stop offset="0" stopColor="#4c66ff" />
          <stop offset="0.5" stopColor="#2f4bff" />
          <stop offset="1" stopColor="#1d31b8" />
        </linearGradient>
        <radialGradient id="mugInside" cx="0.5" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#1a2a9a" />
          <stop offset="1" stopColor="#0f1a66" />
        </radialGradient>
      </defs>
      <ellipse cx="200" cy="352" rx="150" ry="18" fill="#3b2412" opacity="0.18" />
      <path d="M286 170 C352 160 360 270 282 282" fill="none" stroke="#d3bc9e" strokeWidth="26" strokeLinecap="round" />
      <path d="M286 170 C340 164 346 262 282 272" fill="none" stroke="#e6d4bb" strokeWidth="14" strokeLinecap="round" />
      <path d="M100 118 L112 330 Q114 350 140 352 L260 352 Q286 350 288 330 L300 118 Z" fill="url(#mugBody)" />
      <path d="M100 118 L104 190 Q122 206 142 196 Q160 214 182 200 Q204 218 226 202 Q250 216 270 198 Q288 210 296 192 L300 118 Z" fill="url(#mugGlaze)" />
      <ellipse cx="200" cy="118" rx="100" ry="26" fill="#2238d0" />
      <ellipse cx="200" cy="121" rx="88" ry="19" fill="url(#mugInside)" />
      <path d="M118 112 Q160 100 210 101" stroke="#8ea0ff" strokeWidth="3" fill="none" opacity="0.7" strokeLinecap="round" />
      <path d="M128 230 Q132 290 140 330" stroke="#fff" strokeWidth="10" opacity="0.22" fill="none" strokeLinecap="round" />
      {/* The chip: glaze broken away on the front rim, pale clay showing. */}
      <circle cx="152" cy="142" r="30" fill="#ff8a3d" opacity={0.14 * chipGlow} />
      <path d="M134 136 L146 134 L160 136 L166 141 L158 152 L149 158 L140 151 Z" fill="#f2e6d3" />
      <path d="M134 136 L146 134 L160 136 L166 141 L158 152 L149 158 L140 151 Z" fill="none" stroke="#b79a76" strokeWidth="1.6" />
      <path d="M146 140 L152 149" stroke="#cbb08c" strokeWidth="1.4" />
    </svg>
  );
}

/** The buyer's "photo": mug on an oak table in window light, optionally with the paper code next to it. */
export function HeroPhoto({ width, withNote = false, noteDraw = 1, chipGlow = 0, style, children }: { width: number; withNote?: boolean; noteDraw?: number; chipGlow?: number; style?: CSSProperties; children?: ReactNode }) {
  const h = width * 0.75;
  const k = width / 900;
  return (
    <div
      style={{
        width,
        height: h,
        borderRadius: 26 * k,
        overflow: "hidden",
        position: "relative",
        boxShadow: "0 30px 80px -30px rgba(21,23,28,0.45), 0 0 0 1px rgba(21,23,28,0.06)",
        background: "linear-gradient(180deg, #e9e2d6 0%, #ddd3c4 38%, #c69a6b 38.2%, #b98a5c 100%)",
        ...style,
      }}
    >
      {/* Oak grain */}
      <svg viewBox="0 0 900 675" width={width} height={h} style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: 11 }, (_, i) => (
          <path
            key={i}
            d={`M0 ${270 + i * 38} C 220 ${262 + i * 38 + (i % 3) * 6} 520 ${282 + i * 38 - (i % 2) * 8} 900 ${268 + i * 38}`}
            stroke={i % 2 ? "#a77a4d" : "#d2aa7c"}
            strokeWidth={i % 3 ? 2 : 3.5}
            fill="none"
            opacity={0.45}
          />
        ))}
        <rect x="0" y="252" width="900" height="6" fill="#a87b4e" opacity="0.5" />
        {/* Window light */}
        <path d="M120 0 L330 0 L560 675 L250 675 Z" fill="#fff" opacity="0.12" />
        <path d="M380 0 L470 0 L700 675 L590 675 Z" fill="#fff" opacity="0.08" />
      </svg>
      <div style={{ position: "absolute", left: (withNote ? 120 : 250) * k, top: 150 * k }}>
        <Mug size={430 * k} chipGlow={chipGlow} />
      </div>
      {withNote && (
        <div
          style={{
            position: "absolute",
            left: 545 * k,
            top: 395 * k,
            width: 300 * k,
            height: 170 * k,
            background: "#fdfdfb",
            transform: "rotate(-7deg)",
            boxShadow: "0 10px 22px -8px rgba(60,35,10,0.45)",
            clipPath: "polygon(0 4%, 12% 0, 30% 3%, 52% 0, 75% 2%, 100% 0, 99% 30%, 100% 62%, 98% 100%, 70% 97%, 44% 100%, 20% 97%, 0 100%, 2% 55%)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Handwritten text="7KQ4" size={92 * k} draw={noteDraw} />
        </div>
      )}
      {/* Phone-camera grain and vignette */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 45% 40%, transparent 55%, rgba(30,20,10,0.28))" }} />
      {children}
    </div>
  );
}

/** Captions: one clause at a time on a soft dark pill near the bottom. */
export function Captions({ lines }: { lines: { text: string; from: number; to: number }[] }) {
  const frame = useCurrentFrame();
  const line = lines.find((l) => frame >= l.from && frame < l.to);
  if (!line) return null;
  const opacity = interpolate(frame, [line.from, line.from + 5, line.to - 4, line.to], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 34, pointerEvents: "none" }}>
      <div
        style={{
          opacity,
          maxWidth: 1400,
          padding: "10px 24px",
          borderRadius: 14,
          background: "rgba(21,23,28,0.78)",
          color: "#fff",
          fontFamily: SANS,
          fontSize: 30,
          fontWeight: 500,
          lineHeight: 1.3,
          textAlign: "center",
          letterSpacing: "-0.005em",
        }}
      >
        {line.text}
      </div>
    </AbsoluteFill>
  );
}

export const APP_HOST = "clippay.productivityappsforwindows.com";
