// The YouTube thumbnail: the chipped mug, the promise, and the PayPal refund. Rendered as a still (npm run thumbnail).

import { AbsoluteFill } from "remotion";
import { Backdrop, C, Card, HeroPhoto, Icon, LogoMark, SANS } from "./ui";

export function Thumbnail() {
  const k = 900 / 900;
  return (
    <AbsoluteFill style={{ background: "#f6f4ef", fontFamily: SANS }}>
      <Backdrop />
      <div style={{ position: "absolute", left: 90, top: 200, transform: "rotate(-2deg)" }}>
        <HeroPhoto width={900} chipGlow={1}>
          <svg width={900} height={675} style={{ position: "absolute", inset: 0 }}>
            <circle cx={411 * k} cy={306 * k} r={62} fill="none" stroke={C.bad} strokeWidth={8} />
          </svg>
        </HeroPhoto>
      </div>
      <Card style={{ position: "absolute", left: 600, top: 700, display: "flex", alignItems: "center", gap: 22, padding: "26px 36px", borderRadius: 30, transform: "rotate(2deg)" }}>
        <div style={{ width: 70, height: 70, borderRadius: 99, background: C.good, display: "grid", placeItems: "center" }}>
          <Icon name="refund" size={40} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 30, color: C.muted, fontWeight: 600 }}>PayPal refund</div>
          <div style={{ fontSize: 76, fontWeight: 750, letterSpacing: "-0.04em", color: C.good, lineHeight: 1 }}>+$8.00</div>
        </div>
      </Card>
      <div style={{ position: "absolute", left: 1080, top: 150, width: 780 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 40 }}>
          <LogoMark size={76} />
          <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: "-0.04em", color: C.ink }}>ClipPay</div>
        </div>
        <div style={{ fontSize: 132, fontWeight: 750, letterSpacing: "-0.05em", lineHeight: 0.98, color: C.ink }}>
          Chipped?
          <br />
          <span style={{ color: C.brand }}>One photo.</span>
          <br />
          Paid back.
        </div>
        <div style={{ marginTop: 44, fontSize: 40, fontWeight: 600, color: C.muted, letterSpacing: "-0.01em" }}>No return. AI grades it, PayPal pays it.</div>
      </div>
    </AbsoluteFill>
  );
}
