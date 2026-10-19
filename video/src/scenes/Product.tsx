// Scenes 4–6: the claim code, Gemini's grade, and the rules engine that sets the price.

import type { ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { cue } from "../timeline";
import { APP_HOST, BrowserFrame, screenToFrame, C, Card, HeroPhoto, Icon, Kicker, MONO, Pill, Point, Ring, SANS, Words, camAt, ease, easeOut, useIn, useRamp, useRise } from "../ui";

const FRAME = { left: 640, top: 150, width: 1170 };

/** Left column used by the browser scenes: kicker, heading, then points. */
export function SideColumn({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <div style={{ position: "absolute", left: 110, top: 210, width: 470 }}>
      <Kicker at={2}>{kicker}</Kicker>
      <div style={{ height: 20 }} />
      <Words text={title} at={5} style={{ fontSize: 62, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.04 }} />
      <div style={{ height: 46 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>{children}</div>
    </div>
  );
}

export function Proof() {
  const frame = useCurrentFrame();
  const cCode = cue("proof", "gets a four");
  const cWrite = cue("proof", "They write");
  const cProves = cue("proof", "That proves");
  const cam = camAt(frame, [
    { at: 0, z: 1.3, x: 720, y: 330 },
    { at: cCode - 4, z: 1.9, x: 505, y: 320 },
    { at: cWrite + 4, z: 1.3, x: 720, y: 330 },
  ]);
  // The buyer's photo appears big, the code is written on, then it drops into the upload slot.
  const photoIn = useIn(cWrite + 6, { damping: 18, stiffness: 100 });
  const fly = interpolate(frame, [cProves - 22, cProves + 2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const PW = 720;
  // The first upload tile, at the camera's resting position.
  const tile = screenToFrame({ z: 1.3, x: 720, y: 330 }, 739, 269, FRAME.width);
  const slot = { x: FRAME.left + tile.x, y: FRAME.top + 50 + tile.y, w: 98 * tile.scale };
  const left = interpolate(fly, [0, 1], [1010, slot.x]);
  const top = interpolate(fly, [0, 1], [250, slot.y + (slot.w - slot.w * 0.75) / 2]);
  const scale = interpolate(fly, [0, 1], [1, slot.w / PW]);
  const noteDraw = useRamp(cWrite + 16, cWrite + 52);
  const tag = useRise(cue("proof", "photograph it", 0.4), 16);
  return (
    <AbsoluteFill>
      <SideColumn kicker="Step 1 · Proof" title="A code only this claim knows.">
        <Point at={cCode}>Four characters, valid for 30 minutes</Point>
        <Point at={cWrite}>Written on paper, in the same shot as the damage</Point>
        <Point at={cProves} tone={C.good}>
          Proves the photo is fresh, and theirs
        </Point>
      </SideColumn>
      <BrowserFrame layers={[{ src: "screens/claim-code.png" }]} width={FRAME.width} url={`${APP_HOST}/claim/…`} cam={cam} style={{ position: "absolute", left: FRAME.left, top: FRAME.top }}>
        <Ring at={cCode + 8} x={398} y={262} w={213} h={93} label="Unique per claim" />
      </BrowserFrame>
      {frame >= cWrite + 6 && (
        <div
          style={{
            position: "absolute",
            left,
            top,
            transformOrigin: "0 0",
            transform: `scale(${scale * (0.85 + 0.15 * photoIn)}) rotate(${(1 - fly) * 3}deg)`,
            opacity: Math.min(1, photoIn * 1.6),
          }}
        >
          <HeroPhoto width={PW} withNote noteDraw={noteDraw} />
          <div style={{ ...tag, opacity: (tag.opacity as number) * (1 - fly * 3), position: "absolute", left: 0, right: 0, bottom: -70, display: "flex", justifyContent: "center" }}>
            <Pill tone="ink" size={26}>
              <Icon name="camera" color="#fff" size={26} /> Code and damage, one photo
            </Pill>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
}

export function Grade() {
  const frame = useCurrentFrame();
  const PW = 940;
  const k = PW / 900;
  const scan = interpolate(frame, [8, 62], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const scanOn = frame >= 8 && frame <= 66;
  const enter = useIn(0, { damping: 20, stiffness: 100 });
  const cDamage = cue("grade", "what's damaged");
  const rows: { label: string; value: ReactNode; at: number }[] = [
    { label: "Damage", value: <b>Chip</b>, at: cDamage },
    { label: "Where", value: "Rim of the blue mug", at: cue("grade", "where") },
    { label: "Severity", value: <Pill tone="warn" size={26}>Minor</Pill>, at: cue("grade", "how badly") },
    {
      label: "Real photo",
      value: (
        <Pill tone="good" size={26}>
          <Icon name="check" size={24} color={C.good} stroke={2.8} /> Yes
        </Pill>
      ),
      at: cue("grade", "whether it's a real"),
    },
    {
      label: "Code on paper",
      value: (
        <Pill tone="good" size={26}>
          <span style={{ fontFamily: MONO }}>7KQ4</span> <Icon name="check" size={24} color={C.good} stroke={2.8} /> matches
        </Pill>
      ),
      at: cue("grade", "whether the code"),
    },
  ];
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 110, top: 160, opacity: enter, transform: `translateY(${(1 - enter) * 40}px)` }}>
        <HeroPhoto width={PW} withNote chipGlow={useRamp(cDamage, cDamage + 12)}>
          {scanOn && (
            <div style={{ position: "absolute", left: 0, right: 0, top: scan * PW * 0.75 - 160, height: 160 }}>
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent, rgba(47,75,255,0.22))" }} />
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, background: "#8ea0ff", boxShadow: "0 0 24px 6px rgba(47,75,255,0.7)" }} />
            </div>
          )}
          <Ring at={cDamage} x={238 * k} y={262 * k} w={96 * k} h={84 * k} label="chip · rim" />
          <Ring at={cue("grade", "whether the code")} x={530 * k} y={372 * k} w={330 * k} h={200 * k} label="code 7KQ4" color={C.good} />
        </HeroPhoto>
      </div>
      <div style={{ position: "absolute", left: 1120, top: 160, width: 690 }}>
        <Kicker at={2}>Step 2 · Grade</Kicker>
        <div style={{ height: 18 }} />
        <Words text="Gemini reads the photo." at={5} style={{ fontSize: 62, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.04 }} />
        <div style={{ height: 34 }} />
        <Card style={{ padding: "14px 34px 18px" }}>
          {rows.map((r, i) => (
            <Finding key={r.label} {...r} last={i === rows.length - 1} />
          ))}
        </Card>
        <div style={{ ...useRise(cDamage, 14), marginTop: 22, fontFamily: MONO, fontSize: 21, color: C.faint }}>gemini-3.5-flash · structured JSON grade</div>
      </div>
    </AbsoluteFill>
  );
}

function Finding({ label, value, at, last }: { label: string; value: ReactNode; at: number; last: boolean }) {
  const style = useRise(at, 18);
  return (
    <div style={{ ...style, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "19px 0", borderBottom: last ? "none" : `1px solid ${C.line}`, fontSize: 32 }}>
      <span style={{ color: C.muted }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}

const TESTS = [
  "offers the severity band for a clean claim",
  "maps every severity to its band",
  "caps the counter limit at the ceiling",
  "caps the counter limit at the auto-approve limit",
  "reviews: wrong code",
  "reviews: duplicate image",
  "reviews: not a real photo",
  "reviews refunds above the auto-approve limit",
  "the AI can't overspend: holds for every severity, confidence and price",
  "allows only one counter",
  "sends counters above the limit to the merchant",
];

export function Rules() {
  const frame = useCurrentFrame();
  const cRules = cue("rules", "A rules engine");
  const cPct = cue("rules", "a percentage");
  const cCeil = cue("rules", "a ceiling");
  const cAuto = cue("rules", "an auto-approve");
  const cTests = cue("rules", "Thirty-five");
  // The statement starts large in the middle, then moves up to become the scene's heading.
  const up = interpolate(frame, [cRules - 10, cRules + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const gradeIn = useRise(cRules + 4, 40);
  const engineIn = useRise(cRules + 14, 40);
  const offerIn = useIn(cAuto + 18, { damping: 13, stiffness: 150 });
  const a1 = useRamp(cRules + 12, cRules + 24);
  const a2 = useRamp(cAuto + 8, cAuto + 20);
  const testsIn = useRise(cTests - 4, 50);
  const passed = Math.round(interpolate(frame, [cTests, cTests + 70], [0, 35], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeOut }));
  const scroll = interpolate(frame, [cTests + 4, cTests + 4 + TESTS.length * 9], [0, TESTS.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bands: [string, string][] = [
    ["Cosmetic", "10%"],
    ["Minor", "20%"],
    ["Moderate", "35%"],
    ["Severe", "60%"],
  ];
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: interpolate(up, [0, 1], [400, 92]),
          display: "flex",
          justifyContent: "center",
          transform: `scale(${interpolate(up, [0, 1], [1, 0.6])})`,
          transformOrigin: "50% 0",
        }}
      >
        <Words text="The AI never sets the price." at={cue("rules", "But the AI")} stagger={2.6} highlight={{ never: C.brand }} style={{ fontSize: 112, fontWeight: 700, letterSpacing: "-0.04em" }} />
      </div>

      {/* Grade → rules engine → offer */}
      <Card style={{ ...gradeIn, position: "absolute", left: 110, top: 250, width: 430, padding: "30px 34px" }}>
        <Label icon="spark">Gemini grade</Label>
        <KV k="Severity" v={<Pill tone="warn" size={24}>Minor</Pill>} />
        <KV k="Damage" v="Chip · rim" />
        <KV k="Confidence" v="High" />
        <div style={{ marginTop: 18, fontSize: 23, color: C.muted, lineHeight: 1.35 }}>Words and labels only. No amounts.</div>
      </Card>
      <Arrow x={556} y={420} draw={a1} />
      <Card style={{ ...engineIn, position: "absolute", left: 650, top: 250, width: 620, padding: "30px 34px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Label icon="shield">Rules engine</Label>
          <Pill tone="muted" size={20}>
            Merchant policy
          </Pill>
        </div>
        {bands.map(([name, pct]) => (
          <PolicyRow key={name} name={name} value={pct} at={name === "Minor" ? cPct : null} />
        ))}
        <div style={{ height: 1, background: C.line, margin: "10px 0" }} />
        <PolicyRow name="Ceiling" value="60% of price" at={cCeil} />
        <PolicyRow name="Auto-approve" value="up to $100" at={cAuto} />
      </Card>
      <Arrow x={1286} y={420} draw={a2} />
      <Card
        style={{
          position: "absolute",
          left: 1380,
          top: 250,
          width: 430,
          padding: "30px 34px",
          opacity: Math.min(1, offerIn * 1.5),
          transform: `scale(${0.85 + 0.15 * offerIn})`,
          border: `2px solid ${C.brand}`,
        }}
      >
        <Label icon="refund">Offer</Label>
        <div style={{ fontFamily: SANS, fontSize: 128, fontWeight: 700, letterSpacing: "-0.05em", color: C.brandInk, lineHeight: 1.05, marginTop: 6 }}>$8.00</div>
        <div style={{ fontFamily: MONO, fontSize: 26, color: C.muted, marginTop: 6 }}>$40.00 × 20%</div>
        <div style={{ marginTop: 22 }}>
          <Pill tone="good" size={22}>
            <Icon name="check" size={20} color={C.good} stroke={2.8} /> Auto-approved
          </Pill>
        </div>
      </Card>

      {/* The test suite */}
      <div
        style={{
          ...testsIn,
          position: "absolute",
          left: 110,
          top: 742,
          width: 1700,
          height: 200,
          borderRadius: 26,
          background: C.ink,
          display: "flex",
          overflow: "hidden",
          boxShadow: "0 30px 70px -30px rgba(21,23,28,0.55)",
        }}
      >
        <div style={{ width: 420, padding: "26px 40px", borderRight: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ fontFamily: MONO, fontSize: 96, fontWeight: 600, color: "#fff", letterSpacing: "-0.04em", lineHeight: 1 }}>{passed}</div>
          <div style={{ fontFamily: SANS, fontSize: 28, color: "#a8f0cb", marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="check" color="#5ee0a0" size={28} stroke={3} /> rules tests passing
          </div>
        </div>
        <div style={{ flex: 1, position: "relative", overflow: "hidden", padding: "0 40px" }}>
          <div style={{ position: "absolute", left: 40, right: 40, top: 26 - Math.max(0, scroll - 4) * 44 }}>
            {TESTS.map((t, i) => (
              <div key={t} style={{ height: 44, display: "flex", alignItems: "center", gap: 16, fontFamily: MONO, fontSize: 25, color: "#d9dce4", opacity: scroll > i ? 1 : 0 }}>
                <span style={{ color: "#5ee0a0" }}>✓</span>
                {t}
              </div>
            ))}
          </div>
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${C.ink} 0%, transparent 18%, transparent 80%, ${C.ink} 100%)` }} />
        </div>
      </div>
    </AbsoluteFill>
  );
}

function Label({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 24, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>
      <Icon name={icon} size={26} color={C.brand} />
      {children}
    </div>
  );
}

function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: `1px solid ${C.line}`, fontSize: 29 }}>
      <span style={{ color: C.muted }}>{k}</span>
      <span style={{ fontWeight: 500 }}>{v}</span>
    </div>
  );
}

function PolicyRow({ name, value, at }: { name: string; value: string; at: number | null }) {
  const p = useRamp(at ?? 1e9, (at ?? 1e9) + 10);
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "9px 16px",
        margin: "2px -16px",
        borderRadius: 12,
        fontSize: 29,
        background: `rgba(47,75,255,${0.1 * p})`,
        color: p > 0.5 ? C.brandInk : C.ink,
        fontWeight: p > 0.5 ? 600 : 400,
        boxShadow: p > 0 ? `inset 0 0 0 ${2 * p}px ${C.brand}` : "none",
      }}
    >
      <span>{name}</span>
      <span style={{ fontFamily: MONO, fontSize: 27 }}>{value}</span>
    </div>
  );
}

function Arrow({ x, y, draw }: { x: number; y: number; draw: number }) {
  return (
    <svg width={84} height={40} viewBox="0 0 84 40" style={{ position: "absolute", left: x, top: y - 20 }}>
      <path d="M4 20 H74 M60 8 L76 20 L60 32" fill="none" stroke={C.brand} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
    </svg>
  );
}
