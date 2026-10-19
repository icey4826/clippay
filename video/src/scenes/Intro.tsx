// Scenes 1–3: the problem (a chipped mug means a full return) and the ClipPay reveal.

import type { ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { cue } from "../timeline";
import { C, Card, HeroPhoto, Icon, Kicker, LogoMark, MONO, Pill, SANS, Words, ease, easeOut, useIn, useRamp, useRise } from "../ui";

export function Hook({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const enter = useIn(2, { damping: 20, stiffness: 90 });
  const ring = useRamp(cue("hook", "chip on the rim", -0.1), cue("hook", "chip on the rim", 0.7));
  const k = 860 / 900;
  const steps = [
    { icon: "tag", text: "Print a return label", at: cue("hook", "a label") },
    { icon: "pin", text: "Drive to the post office", at: cue("hook", "a trip") },
    { icon: "clock", text: "Wait a week for the $40", at: cue("hook", "and a week") },
  ];
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 190,
          transform: `translateY(${(1 - enter) * 80}px) rotate(${-3 + enter * 1.6}deg) scale(${interpolate(frame, [0, duration], [1, 1.045])})`,
          opacity: Math.min(1, enter * 1.5),
        }}
      >
        <HeroPhoto width={860} chipGlow={ring}>
          <svg width={860} height={645} style={{ position: "absolute", inset: 0 }}>
            <circle
              cx={411 * k}
              cy={306 * k}
              r={56}
              fill="none"
              stroke={C.bad}
              strokeWidth={6}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - ring}
              transform={`rotate(-80 ${411 * k} ${306 * k})`}
            />
          </svg>
        </HeroPhoto>
      </div>
      <div style={{ position: "absolute", left: 1050, top: 210, width: 780 }}>
        <Words text="$40 mug set." at={cue("hook", "A forty")} style={{ fontSize: 104, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.02 }} />
        <Words
          text="Arrived chipped."
          at={cue("hook", "arrives")}
          highlight={{ chipped: C.bad }}
          style={{ fontSize: 104, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.02 }}
        />
        <div style={{ height: 70 }} />
        <Kicker at={cue("hook", "Today")} color={C.muted}>
          Today, that means a return
        </Kicker>
        <div style={{ height: 26 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {steps.map((s) => (
            <Step key={s.text} {...s} />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
}

function Step({ icon, text, at }: { icon: string; text: string; at: number }) {
  const style = useRise(at, 30);
  return (
    <Card style={{ ...style, display: "flex", alignItems: "center", gap: 22, padding: "20px 26px", borderRadius: 22 }}>
      <div style={{ width: 54, height: 54, borderRadius: 16, background: "#f1eee7", display: "grid", placeItems: "center" }}>
        <Icon name={icon} size={30} color={C.ink} />
      </div>
      <div style={{ fontSize: 36, fontWeight: 500, letterSpacing: "-0.01em" }}>{text}</div>
    </Card>
  );
}

export function Cost() {
  const frame = useCurrentFrame();
  const c1 = cue("cost", "They refund");
  const c2 = cue("cost", "pay eight");
  const total = interpolate(frame, [c1, c1 + 22, c2, c2 + 22], [0, 40, 40, 48], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeOut });
  const totalIn = useRise(c1, 20);
  const rows = [
    { icon: "refund", label: "Full refund to the buyer", value: <Amount>−$40.00</Amount>, at: c1 },
    { icon: "box", label: "Return shipping label", value: <Amount>−$8.00</Amount>, at: c2 },
    { icon: "noship", label: "The mug itself", value: <Pill tone="bad" size={24}>Thrown away</Pill>, at: cue("cost", "throw away", -0.3) },
    {
      icon: "heart",
      label: "Customer trust",
      value: (
        <Pill tone="bad" size={24}>
          <Icon name="down" size={22} color={C.bad} stroke={2.6} /> A little lower
        </Pill>
      ),
      at: cue("cost", "still lose"),
    },
  ];
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 110, top: 330, width: 660 }}>
        <Kicker at={2}>The store&apos;s side</Kicker>
        <div style={{ height: 22 }} />
        <Words text="For the store, it's worse." at={6} highlight={{ worse: C.bad }} style={{ fontSize: 92, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.02 }} />
      </div>
      <Card style={{ position: "absolute", left: 860, top: 150, width: 950, padding: "34px 44px 36px" }}>
        <div style={{ fontSize: 24, color: C.muted, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>One chipped mug, returned</div>
        <div style={{ height: 14 }} />
        {rows.map((r) => (
          <Row key={r.label} {...r} />
        ))}
        <div style={{ ...totalIn, marginTop: 26, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ fontSize: 30, color: C.muted, paddingBottom: 18 }}>Lost on a $40 sale</div>
          <div style={{ fontFamily: MONO, fontSize: 118, fontWeight: 600, color: C.bad, letterSpacing: "-0.04em", lineHeight: 1 }}>
            −${total.toFixed(2)}
          </div>
        </div>
      </Card>
    </AbsoluteFill>
  );
}

function Amount({ children }: { children: string }) {
  return <span style={{ fontFamily: MONO, fontSize: 38, fontWeight: 500, color: C.ink }}>{children}</span>;
}

function Row({ icon, label, value, at }: { icon: string; label: string; value: ReactNode; at: number }) {
  const style = useRise(at, 24);
  return (
    <div style={{ ...style, display: "flex", alignItems: "center", gap: 22, padding: "20px 0", borderBottom: `1px solid ${C.line}` }}>
      <div style={{ width: 52, height: 52, borderRadius: 15, background: "#f3f1eb", display: "grid", placeItems: "center" }}>
        <Icon name={icon} size={28} color={C.muted} />
      </div>
      <div style={{ flex: 1, fontSize: 34, fontWeight: 500 }}>{label}</div>
      {value}
    </div>
  );
}

export function Reveal() {
  const frame = useCurrentFrame();
  // A brand panel wipes in from the centre, then shrinks into the logo mark.
  const grow = interpolate(frame, [0, 13], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const shrink = interpolate(frame, [17, 38], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeOut });
  const MARK = 190;
  const lockupW = MARK + 44 + 640;
  const markX = (1920 - lockupW) / 2;
  const markY = 250;
  const x = interpolate(shrink, [0, 1], [0, markX]);
  const y = interpolate(shrink, [0, 1], [0, markY]);
  const w = interpolate(shrink, [0, 1], [1920, MARK]);
  const h = interpolate(shrink, [0, 1], [1080, MARK]);
  const r = interpolate(shrink, [0, 1], [0, MARK * (7 / 24)]);
  const draw = useRamp(34, 62);
  const word = useRamp(36, 58, easeOut);
  const chips = [
    { icon: "camera", text: "One photo", at: cue("reveal", "one photo") },
    { icon: "refund", text: "Partial PayPal refund", at: cue("reveal", "a partial") },
    { icon: "keep", text: "Buyer keeps the item", at: cue("reveal", "The buyer keeps") },
    { icon: "noship", text: "Nothing shipped back", at: cue("reveal", "Nothing") },
  ];
  return (
    <AbsoluteFill>
      {frame < 40 && (
        <div
          style={{
            position: "absolute",
            left: x,
            top: y,
            width: w,
            height: h,
            borderRadius: r,
            background: C.brand,
            clipPath: `circle(${grow * 120}% at 50% 50%)`,
          }}
        />
      )}
      {frame >= 38 && (
        <div style={{ position: "absolute", left: markX, top: markY }}>
          <LogoMark size={MARK} draw={draw} />
        </div>
      )}
      <div style={{ position: "absolute", left: markX + MARK + 44, top: markY - 6, height: MARK + 12, overflow: "hidden", display: "flex", alignItems: "center" }}>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 176,
            fontWeight: 700,
            letterSpacing: "-0.05em",
            color: C.ink,
            transform: `translateX(${(1 - word) * -120}px)`,
            opacity: word,
          }}
        >
          ClipPay
        </div>
      </div>
      <div style={{ position: "absolute", top: 520, width: "100%", display: "flex", justifyContent: "center" }}>
        <Words
          text="Damage claims, settled with one photo and a partial refund."
          at={cue("reveal", "settles")}
          stagger={1.6}
          style={{ fontSize: 50, fontWeight: 500, color: C.muted, letterSpacing: "-0.02em", textAlign: "center" }}
        />
      </div>
      <div style={{ position: "absolute", top: 660, width: "100%", display: "flex", justifyContent: "center", gap: 22 }}>
        {chips.map((c) => (
          <Chip key={c.text} {...c} />
        ))}
      </div>
    </AbsoluteFill>
  );
}

function Chip({ icon, text, at }: { icon: string; text: string; at: number }) {
  const p = useIn(at, { damping: 13, stiffness: 160 });
  return (
    <Card
      style={{
        opacity: Math.min(1, p * 1.5),
        transform: `translateY(${(1 - p) * 40}px) scale(${0.9 + 0.1 * p})`,
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "20px 30px",
        borderRadius: 999,
      }}
    >
      <div style={{ width: 46, height: 46, borderRadius: 99, background: C.brandSoft, display: "grid", placeItems: "center" }}>
        <Icon name={icon} size={26} color={C.brand} />
      </div>
      <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.01em" }}>{text}</div>
    </Card>
  );
}
