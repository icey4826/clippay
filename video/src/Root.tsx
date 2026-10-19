import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import { useEffect, useState, type ComponentType } from "react";
import { AbsoluteFill, Audio, Composition, Sequence, continueRender, delayRender, interpolate, staticFile } from "remotion";
import { Cost, Hook, Reveal } from "./scenes/Intro";
import { Live } from "./scenes/Live";
import { Close, Merchant, Offer, Refund } from "./scenes/Payout";
import { Grade, Proof, Rules } from "./scenes/Product";
import { SFX } from "./sfx";
import { Thumbnail } from "./Thumbnail";
import { FPS, HEIGHT, SCENES, TOTAL_FRAMES, WIDTH, captions, cue, type SceneId } from "./timeline";
import { Backdrop, Captions, SceneShell } from "./ui";

const VIEWS: Record<SceneId, ComponentType<{ duration: number }>> = {
  hook: Hook,
  cost: Cost,
  reveal: Reveal,
  proof: Proof,
  grade: Grade,
  rules: Rules,
  offer: Offer,
  refund: Refund,
  merchant: Merchant,
  live: Live,
  close: Close,
};

/** Global frame ranges where the narrator is speaking, for ducking the music. */
const SPEECH = SCENES.map((s) => [s.from + s.voiceFrom, s.from + s.voiceFrom + Math.round(s.voiceSeconds * FPS)] as const);

const MUSIC_UNDER_VOICE = 0.11;
const MUSIC_ALONE = 0.26;

function musicVolume(f: number) {
  // Distance in frames to the nearest speech; the music swells a little in the gaps.
  let gap = Infinity;
  for (const [a, b] of SPEECH) {
    if (f >= a && f <= b) {
      gap = 0;
      break;
    }
    gap = Math.min(gap, f < a ? a - f : f - b);
  }
  const level = interpolate(gap, [4, 16], [MUSIC_UNDER_VOICE, MUSIC_ALONE], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeIn = interpolate(f, [0, 20], [0.4, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(f, [TOTAL_FRAMES - 75, TOTAL_FRAMES - 2], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return level * fadeIn * fadeOut;
}

function useFonts() {
  const [handle] = useState(() => delayRender("Loading Geist"));
  useEffect(() => {
    Promise.all([document.fonts.load('700 64px "Geist Variable"'), document.fonts.load('400 32px "Geist Mono Variable"')])
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  }, [handle]);
}

export function ClipPayDemo({ showCaptions }: { showCaptions: boolean }) {
  useFonts();
  return (
    <AbsoluteFill style={{ background: "#f6f4ef" }}>
      <Backdrop />
      <Audio src={staticFile("music.wav")} volume={musicVolume} />
      {SFX.map((s, i) => (
        <Sequence key={`sfx-${i}`} from={Math.max(0, s.at)} durationInFrames={90} name={`sfx ${s.name}`} layout="none">
          <Audio src={staticFile(`sfx/${s.name}.wav`)} volume={s.volume} />
        </Sequence>
      ))}
      {SCENES.map((s) => {
        const View = VIEWS[s.id];
        // The end card shows the closing words itself, so captions stop there.
        const lines = captions(s.id).filter((l) => s.id !== "close" || l.from < cue("close", "ClipPay."));
        return (
          <Sequence key={s.id} from={s.from} durationInFrames={s.durationInFrames} name={s.id}>
            <SceneShell duration={s.durationInFrames}>
              <View duration={s.durationInFrames} />
            </SceneShell>
            <Sequence from={s.voiceFrom} name={`${s.id} voice`}>
              <Audio src={staticFile(`voice/${s.id}.wav`)} volume={1} />
            </Sequence>
            {showCaptions && <Captions lines={lines} />}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

function ThumbnailStill() {
  useFonts();
  return <Thumbnail />;
}

export function Root() {
  return (
    <>
      <Composition id="Thumbnail" component={ThumbnailStill} durationInFrames={1} fps={FPS} width={WIDTH} height={HEIGHT} />
      <Composition
      id="ClipPayDemo"
      component={ClipPayDemo}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ showCaptions: true }}
      />
    </>
  );
}
