// Scene: the real app, screen-recorded end to end in the PayPal sandbox, fitted to the narration.

import { AbsoluteFill, Freeze, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { LIVE_ASPECT, LIVE_CLICKS, LIVE_PHOTO, LIVE_RINGS, liveFrame, liveLayout, toBox, type LiveClip } from "../live";
import { FPS, cue } from "../timeline";
import { C, Card, Cursor, Icon, Pill, Ring, SANS, ease, useIn, useRise } from "../ui";
import { SideColumn } from "./Product";

const BOX = { left: 640, width: 1180, height: Math.round(1180 / LIVE_ASPECT) };
BOX.height = Math.min(BOX.height, 820);
const BOX_TOP = Math.round((1080 - BOX.height) / 2) - 10;

/** Frames the cursor takes to glide onto a button before clicking, and stays after. */
const GLIDE = 16;
const LINGER = 14;

function Footage({ clip, rate }: { clip: LiveClip; rate: number }) {
  const frame = useCurrentFrame();
  const z = !clip.zoom ? 1 : clip.zoom.instant ? clip.zoom.z : interpolate(frame, [0, 14], [1, clip.zoom.z], { extrapolateRight: "clamp", easing: ease });
  const ox = (clip.zoom?.x ?? 0.5) * 100;
  const oy = (clip.zoom?.y ?? 0.5) * 100;
  return (
    <AbsoluteFill style={{ transform: `scale(${z})`, transformOrigin: `${ox}% ${oy}%` }}>
      <OffthreadVideo
        src={staticFile(clip.file)}
        trimBefore={Math.round(clip.from * FPS)}
        playbackRate={rate}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </AbsoluteFill>
  );
}

export function Live({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const layout = liveLayout(duration);
  const current = layout.find((s) => frame >= s.start && frame < s.end) ?? layout[layout.length - 1];
  const boxIn = useIn(3, { damping: 20, stiffness: 90 });
  // The photo gets its own moment between "photograph it" and the review.
  const photoAt = cue("live", "photograph it", -0.1);
  const photoOut = cue("live", "This crack", 0.6);
  const photoIn = useIn(photoAt, { damping: 16, stiffness: 110 });
  const photoGone = interpolate(frame, [photoOut - 8, photoOut + 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const photoVisible = frame >= photoAt && frame < photoOut + 4;
  const fast = current.rate >= 1.5;
  return (
    <AbsoluteFill>
      <SideColumn kicker="Live · PayPal sandbox" title="The real app, end to end.">
        {layout.map((s, i) => (
          <StepRow key={s.id} n={i + 1} label={s.label} icon={s.icon} at={10 + i * 4} active={current.id === s.id} done={frame >= s.end} />
        ))}
      </SideColumn>
      <div
        style={{
          position: "absolute",
          left: BOX.left,
          top: BOX_TOP,
          width: BOX.width,
          height: BOX.height,
          borderRadius: 22,
          overflow: "hidden",
          background: "#0f1115",
          border: `1px solid ${C.line}`,
          boxShadow: "0 2px 4px rgba(21,23,28,0.04), 0 40px 90px -30px rgba(21,23,28,0.4)",
          opacity: Math.min(1, boxIn * 1.4),
          transform: `translateY(${(1 - boxIn) * 60}px) scale(${0.96 + 0.04 * boxIn})`,
        }}
      >
        {layout.map((s) =>
          s.clips.map((p, k) => (
            <Sequence key={`${s.id}-${k}`} from={p.from} durationInFrames={p.frames} layout="none">
              <Footage clip={p.clip} rate={p.rate} />
            </Sequence>
          )),
        )}
        {layout.map((s) => {
          const last = s.clips[s.clips.length - 1];
          if (!last || s.hold <= 0) return null;
          return (
            <Sequence key={`${s.id}-hold`} from={last.from + last.frames} durationInFrames={s.hold} layout="none">
              <Freeze frame={last.frames - 1}>
                <Footage clip={last.clip} rate={last.rate} />
              </Freeze>
            </Sequence>
          );
        })}
        <Marks layout={layout} />
      </div>
      <div style={{ position: "absolute", left: BOX.left + 22, top: BOX_TOP - 22, display: "flex", gap: 12, opacity: boxIn }}>
        <Pill tone="bad" size={22} style={{ background: C.bad, color: "#fff", boxShadow: "0 8px 20px -8px rgba(200,40,40,0.6)" }}>
          <span style={{ width: 10, height: 10, borderRadius: 99, background: "#fff", opacity: 0.55 + 0.45 * Math.abs(Math.sin(frame / 9)) }} />
          LIVE
        </Pill>
        <Pill tone="muted" size={22} style={{ background: "#fff", color: C.ink, boxShadow: "0 8px 20px -10px rgba(21,23,28,0.35)" }}>
          clippay.productivityappsforwindows.com
        </Pill>
      </div>
      {fast && (
        <div style={{ position: "absolute", left: BOX.left + BOX.width - 22, top: BOX_TOP + BOX.height - 22, transform: "translate(-100%, -100%)" }}>
          <Pill tone="ink" size={20} style={{ background: "rgba(15,17,21,0.72)", color: "#fff", fontFamily: SANS }}>
            {current.rate.toFixed(current.rate < 10 ? 1 : 0)}× speed
          </Pill>
        </div>
      )}
      {photoVisible && (
        <div
          style={{
            position: "absolute",
            left: BOX.left + BOX.width / 2,
            top: BOX_TOP + BOX.height / 2,
            transform: `translate(-50%, -50%) translateY(${(1 - photoIn) * 80 + photoGone * 40}px) rotate(${2.5 - photoIn * 1.5}deg) scale(${0.9 + 0.1 * photoIn - photoGone * 0.08})`,
            opacity: Math.min(1, photoIn * 1.5) * (1 - photoGone),
          }}
        >
          <Card style={{ padding: 14, borderRadius: 26 }}>
            <Img src={staticFile(LIVE_PHOTO)} style={{ display: "block", height: Math.round(BOX.height * 0.78), width: "auto", maxWidth: BOX.width * 0.8, borderRadius: 16, objectFit: "cover" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 6px 2px", fontSize: 24, fontWeight: 600 }}>
              <Icon name="camera" size={24} color={C.brand} /> Stand-in photo, AI-generated for this demo
            </div>
          </Card>
        </div>
      )}
    </AbsoluteFill>
  );
}

/** Clicks (a cursor gliding onto the button) and highlight rings, placed over the footage at their source moments. */
function Marks({ layout }: { layout: ReturnType<typeof liveLayout> }) {
  return (
    <>
      {LIVE_CLICKS.map((m) => {
        const f = liveFrame(layout, m.file, m.t);
        if (!f) return null;
        const p = toBox(f.clip, BOX, m.x, m.y);
        return (
          <Sequence key={`click-${m.t}`} from={f.at - GLIDE} durationInFrames={GLIDE + LINGER + 8} layout="none">
            <FadingCursor x={p.x} y={p.y} />
          </Sequence>
        );
      })}
      {LIVE_RINGS.map((m) => {
        const f = liveFrame(layout, m.file, m.t);
        if (!f) return null;
        const end = m.until !== undefined ? (liveFrame(layout, m.file, m.until)?.at ?? f.stepEnd) : f.stepEnd;
        const r = toBox(f.clip, BOX, m.x, m.y, m.w, m.h);
        return (
          <Sequence key={`ring-${m.t}`} from={f.at} durationInFrames={Math.max(1, end - f.at)} layout="none">
            <Ring at={0} x={r.x} y={r.y} w={r.w} h={r.h} label={m.label} color={m.tone === "warn" ? C.warn : C.good} labelSize={24} labelAlign={m.align} />
          </Sequence>
        );
      })}
    </>
  );
}

function FadingCursor({ x, y }: { x: number; y: number }) {
  const frame = useCurrentFrame();
  const out = interpolate(frame, [GLIDE + LINGER, GLIDE + LINGER + 8], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", inset: 0, opacity: out }}>
      <Cursor keys={[{ at: 0, x: x + 150, y: y + 110 }, { at: GLIDE, x, y, click: true }]} />
    </div>
  );
}

function StepRow({ n, label, icon, at, active, done }: { n: number; label: string; icon: string; at: number; active: boolean; done: boolean }) {
  const style = useRise(at, 22);
  return (
    <div
      style={{
        ...style,
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "14px 18px",
        fontFamily: SANS,
        borderRadius: 18,
        background: active ? C.brandSoft : "transparent",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 99,
          display: "grid",
          placeItems: "center",
          background: done ? C.good : active ? C.brand : "#ece9e2",
          color: "#fff",
          fontSize: 22,
          fontWeight: 700,
        }}
      >
        {done ? <Icon name="check" size={24} color="#fff" stroke={3} /> : active ? <Icon name={icon} size={24} color="#fff" /> : <span style={{ color: C.muted }}>{n}</span>}
      </div>
      <div style={{ fontSize: 30, fontWeight: active ? 650 : 500, color: active || done ? C.ink : C.muted, letterSpacing: "-0.01em" }}>{label}</div>
    </div>
  );
}
