// Scenes 7–10: the offer and counter, the PayPal partial refund, the merchant dashboard, and the close.

import type { ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { cue } from "../timeline";
import { APP_HOST, BrowserFrame, C, Card, Cursor, Icon, Kicker, LogoMark, MONO, Pill, Point, Ring, SANS, Words, camAt, ease, easeOut, useIn, useRamp, useRise } from "../ui";
import { SideColumn } from "./Product";

export function Offer() {
  const frame = useCurrentFrame();
  const cCounter = cue("offer", "or counter once");
  const cSmall = cue("offer", "A small counter");
  const click1 = cCounter - 2;
  const click2 = cSmall + 4;
  const counter = useRamp(click1 + 4, click1 + 10);
  const done = useRamp(click2 + 8, click2 + 18);
  const cam = camAt(frame, [
    { at: 0, z: 1.3, x: 560, y: 380 },
    { at: click2 + 10, z: 1.3, x: 720, y: 330 },
  ]);
  return (
    <AbsoluteFill>
      <SideColumn kicker="Step 3 · Offer" title="One offer. One counter.">
        <Point at={cue("offer", "They can accept")}>Accept $8.00 in one tap</Point>
        <Point at={cCounter}>Or ask for more, once</Point>
        <Point at={cSmall} tone={C.good} icon="bolt">
          Small counter: approved on the spot
        </Point>
        <Point at={cue("offer", "Anything bigger")} tone={C.warn} icon="user">
          Bigger: a person decides
        </Point>
      </SideColumn>
      <BrowserFrame
        layers={[
          { src: "screens/offer.png" },
          { src: "screens/counter.png", opacity: counter * (1 - done) },
          { src: "screens/refunded.png", opacity: done },
        ]}
        width={1170}
        url={`${APP_HOST}/claim/…`}
        cam={cam}
        style={{ position: "absolute", left: 640, top: 150 }}
      >
        <Cursor
          appear={6}
          keys={[
            { at: 0, x: 1080, y: 760 },
            { at: cue("offer", "They can accept") + 6, x: 560, y: 432 },
            { at: click1, x: 538, y: 476, click: true },
            { at: cue("offer", "or counter", 0.9), x: 560, y: 540 },
            { at: click2, x: 678, y: 543, click: true },
            { at: click2 + 40, x: 980, y: 640 },
          ]}
        />
        <Ring at={click2 + 22} x={584} y={302} w={272} h={32} color={C.good} />
      </BrowserFrame>
    </AbsoluteFill>
  );
}

const CLAIM_ID = "8c41e0d2-6f3a-4b9e-a2d7-51c9e3f07b6a";

export function Refund() {
  const frame = useCurrentFrame();
  const cPartial = cue("refund", "a partial refund");
  const cKey = cue("refund", "idempotency key");
  const cRetry = cue("refund", "so a retry");
  const cMoney = cue("refund", "Photo to money");
  const bar = interpolate(frame, [cPartial, cPartial + 24], [0, 0.25], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeOut });
  const flipped = frame >= cPartial + 26;
  const flip = useIn(cPartial + 26, { damping: 12, stiffness: 180 });
  const leftIn = useRise(4, 40);
  const rightIn = useRise(10, 40);
  const keyHi = useRamp(cKey, cKey + 10);
  const retry = useRise(cRetry, 20);
  const moneyIn = useRise(cMoney - 4, 30);
  const sweep = useRamp(cMoney, cMoney + 45, easeOut);
  const lines: { at: number; node: ReactNode }[] = [
    {
      at: 14,
      node: (
        <>
          <span style={{ color: "#8ea0ff" }}>POST</span> /v2/payments/captures/<span style={{ color: "#f6c177" }}>{"{capture_id}"}</span>/refund
        </>
      ),
    },
    {
      at: cKey - 6,
      node: (
        <span
          style={{
            padding: "2px 10px",
            margin: "0 -10px",
            borderRadius: 8,
            background: `rgba(94,224,160,${0.16 * keyHi})`,
            boxShadow: `inset 0 0 0 ${2 * keyHi}px rgba(94,224,160,0.8)`,
          }}
        >
          PayPal-Request-Id: <span style={{ color: "#5ee0a0" }}>refund-{CLAIM_ID}</span>
        </span>
      ),
    },
    {
      at: 22,
      node: (
        <>
          {"{ "}
          <span style={{ color: "#c4a7e7" }}>&quot;amount&quot;</span>
          {": { "}
          <span style={{ color: "#c4a7e7" }}>&quot;value&quot;</span>: <span style={{ color: "#f6c177" }}>&quot;10.00&quot;</span>,{" "}
          <span style={{ color: "#c4a7e7" }}>&quot;currency_code&quot;</span>: <span style={{ color: "#f6c177" }}>&quot;USD&quot;</span>
          {" } }"}
        </>
      ),
    },
    {
      at: cPartial + 20,
      node: (
        <>
          <span style={{ color: "#5ee0a0" }}>201</span> <span style={{ color: "#9aa0ad" }}>refund status</span> COMPLETED
        </>
      ),
    },
  ];
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 110, top: 96 }}>
        <Kicker at={2}>Step 4 · Refund</Kicker>
        <div style={{ height: 16 }} />
        <Words text="A partial refund on the original payment." at={5} style={{ fontSize: 62, fontWeight: 700, letterSpacing: "-0.035em" }} />
      </div>

      <Card style={{ ...leftIn, position: "absolute", left: 110, top: 300, width: 700, padding: "34px 40px 36px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted }}>PayPal capture</div>
          <div style={{ transform: `scale(${flipped ? 0.9 + 0.1 * flip : 1})` }}>
            {flipped ? (
              <Pill tone="warn" size={22}>
                PARTIALLY_REFUNDED
              </Pill>
            ) : (
              <Pill tone="good" size={22}>
                COMPLETED
              </Pill>
            )}
          </div>
        </div>
        <div style={{ fontSize: 30, color: C.muted, marginTop: 26 }}>Stoneware mug set (4)</div>
        <div style={{ fontFamily: SANS, fontSize: 104, fontWeight: 700, letterSpacing: "-0.045em", lineHeight: 1.05 }}>$40.00</div>
        <div style={{ marginTop: 26, height: 22, borderRadius: 99, background: "#ece9e1", overflow: "hidden", display: "flex" }}>
          <div style={{ width: `${bar * 100}%`, background: C.brand, borderRadius: 99 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, fontSize: 27 }}>
          <span style={{ color: C.brandInk, fontWeight: 600, opacity: bar > 0.01 ? 1 : 0 }}>$10.00 back to the buyer</span>
          <span style={{ color: C.muted }}>sale kept</span>
        </div>
      </Card>

      <div
        style={{
          ...rightIn,
          position: "absolute",
          left: 870,
          top: 300,
          width: 940,
          borderRadius: 26,
          background: C.ink,
          padding: "30px 38px",
          fontFamily: MONO,
          fontSize: 23,
          lineHeight: 1.5,
          color: "#e6e8ee",
          boxShadow: "0 30px 70px -30px rgba(21,23,28,0.55)",
        }}
      >
        <div style={{ display: "flex", gap: 9, marginBottom: 20 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: 12, height: 12, borderRadius: 99, background: "rgba(255,255,255,0.18)" }} />
          ))}
        </div>
        {lines.map((l, i) => (
          <Line key={i} at={l.at}>
            {l.node}
          </Line>
        ))}
        <div style={{ ...retry, marginTop: 22, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", gap: 16, fontFamily: SANS, fontSize: 27 }}>
          <Icon name="retry" color="#8ea0ff" size={30} />
          <span>Retry with the same id</span>
          <Icon name="arrow" color="#9aa0ad" size={26} />
          <span>same refund.</span>
          <span style={{ marginLeft: "auto" }}>
            <Pill tone="good" size={22}>
              Paid once
            </Pill>
          </span>
        </div>
      </div>

      <div style={{ ...moneyIn, position: "absolute", left: 0, right: 0, top: 790, display: "flex", justifyContent: "center", alignItems: "center", gap: 30 }}>
        <svg width={92} height={92} viewBox="0 0 92 92">
          <circle cx="46" cy="46" r="38" fill="none" stroke="#e4e0d6" strokeWidth="9" />
          <circle cx="46" cy="46" r="38" fill="none" stroke={C.good} strokeWidth="9" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - sweep * 0.7} transform="rotate(-90 46 46)" />
        </svg>
        <div style={{ fontFamily: SANS, fontSize: 64, fontWeight: 700, letterSpacing: "-0.035em", color: C.ink }}>
          Photo to money in <span style={{ color: C.good }}>under a minute.</span>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function Line({ at, children }: { at: number; children: ReactNode }) {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [at, at + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <div style={{ opacity: o, transform: `translateX(${(1 - o) * -14}px)`, whiteSpace: "nowrap", minHeight: 40 }}>{children}</div>;
}

export function Merchant() {
  const frame = useCurrentFrame();
  const cRefunded = cue("merchant", "what they refunded");
  const cSaved = cue("merchant", "what they saved");
  const cQueue = cue("merchant", "a short queue");
  const cMissing = cue("merchant", "like a missing");
  const cam = camAt(
    frame,
    [
      { at: 0, z: 1, x: 720, y: 340 },
      { at: cRefunded - 8, z: 1.7, x: 360, y: 222 },
      { at: cQueue - 8, z: 1.6, x: 1100, y: 260 },
      { at: cMissing - 10, z: 1.45, x: 760, y: 560 },
    ],
    28,
  );
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 210, top: 62, display: "flex", alignItems: "baseline", gap: 26 }}>
        <Kicker at={2}>For merchants</Kicker>
        <Words text="Every claim in one dashboard." at={5} style={{ fontSize: 56, fontWeight: 700, letterSpacing: "-0.035em" }} />
      </div>
      <BrowserFrame
        layers={[{ src: "screens/dashboard.png", h: 1000 }]}
        width={1500}
        viewH={680}
        url={`${APP_HOST}/merchant`}
        cam={cam}
        style={{ position: "absolute", left: 210, top: 160 }}
      >
        <Ring at={cRefunded} x={106} y={166} w={233} h={106} label="Refunded" />
        <Ring at={cSaved} x={355} y={166} w={234} h={106} label="Saved vs. full returns" color={C.good} />
        <Ring at={cQueue + 4} x={1101} y={166} w={233} h={106} label="Needs a human" color={C.warn} labelSide="bottom" />
        <Ring at={cue("merchant", "a missing code")} x={714} y={612} w={94} h={25} label="Missing code" color={C.warn} labelSide="bottom" />
        <Ring at={cue("merchant", "a reused photo")} x={714} y={474} w={110} h={25} label="Reused photo" color={C.warn} />
      </BrowserFrame>
    </AbsoluteFill>
  );
}

export function Close() {
  const frame = useCurrentFrame();
  const cEnd = cue("close", "ClipPay.");
  const out = interpolate(frame, [cEnd - 12, cEnd], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const pulse = 0.5 + 0.5 * Math.sin(frame / 6);
  const chips: { icon: string; text: string; at: number }[] = [
    { icon: "bolt", text: "Cloudflare Workers + D1", at: cue("close", "on Cloudflare") },
    { icon: "refund", text: "PayPal Orders & Payments", at: cue("close", "PayPal payments") },
    { icon: "spark", text: "Gemini 3.5 Flash", at: cue("close", "Gemini grading") },
    { icon: "box", text: "Next.js", at: cue("close", "Gemini grading", 0.5) },
  ];
  const mark = useIn(cEnd - 2, { damping: 14, stiffness: 120 });
  const word = useRamp(cEnd + 2, cEnd + 20, easeOut);
  const urlIn = useRise(cue("close", "Keep the customer", 0.6), 20);
  const liveUrl = useRise(14, 20);
  const markDraw = useRamp(cEnd + 4, cEnd + 26);
  return (
    <AbsoluteFill>
      {out < 1 && (
        <AbsoluteFill style={{ opacity: 1 - out, transform: `translateY(${-40 * out}px)`, alignItems: "center", paddingTop: 260 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
            <div style={{ width: 30, height: 30, borderRadius: 99, background: C.good, boxShadow: `0 0 0 ${8 + pulse * 10}px rgba(17,134,90,${0.25 - pulse * 0.15})` }} />
            <Words text="Live today." at={8} style={{ fontSize: 120, fontWeight: 700, letterSpacing: "-0.045em" }} />
          </div>
          <div style={{ ...liveUrl, marginTop: 26, fontFamily: MONO, fontSize: 36, color: C.brandInk, padding: "12px 28px", borderRadius: 16, background: C.brandSoft }}>
            {APP_HOST}
          </div>
          <div style={{ display: "flex", gap: 22, marginTop: 90 }}>
            {chips.map((c) => (
              <TechChip key={c.text} {...c} />
            ))}
          </div>
        </AbsoluteFill>
      )}
      {frame >= cEnd - 2 && (
        <AbsoluteFill style={{ alignItems: "center", paddingTop: 250 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
            <div style={{ transform: `scale(${mark}) rotate(${(1 - mark) * -20}deg)` }}>
              <LogoMark size={150} draw={markDraw} />
            </div>
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontFamily: SANS, fontSize: 150, fontWeight: 700, letterSpacing: "-0.05em", color: C.ink, opacity: word, transform: `translateX(${(1 - word) * -90}px)` }}>
                ClipPay
              </div>
            </div>
          </div>
          <div style={{ marginTop: 60, display: "flex", gap: 30 }}>
            <Words text="Keep the item." at={cue("close", "Keep the item")} style={{ fontSize: 76, fontWeight: 600, letterSpacing: "-0.035em" }} />
            <Words
              text="Keep the customer."
              at={cue("close", "Keep the customer")}
              highlight={{ Keep: C.brand, the: C.brand, customer: C.brand }}
              style={{ fontSize: 76, fontWeight: 600, letterSpacing: "-0.035em" }}
            />
          </div>
          <div style={{ ...urlIn, marginTop: 90, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
            <div style={{ fontFamily: MONO, fontSize: 34, color: C.ink }}>{APP_HOST}</div>
            <div style={{ fontFamily: SANS, fontSize: 24, color: C.faint }}>PayPal sandbox · Gemini · Cloudflare Workers</div>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}

function TechChip({ icon, text, at }: { icon: string; text: string; at: number }) {
  const p = useIn(at, { damping: 13, stiffness: 160 });
  return (
    <Card style={{ opacity: Math.min(1, p * 1.5), transform: `translateY(${(1 - p) * 40}px)`, display: "flex", alignItems: "center", gap: 14, padding: "18px 28px", borderRadius: 999 }}>
      <Icon name={icon} size={28} color={C.brand} />
      <span style={{ fontSize: 32, fontWeight: 600 }}>{text}</span>
    </Card>
  );
}
