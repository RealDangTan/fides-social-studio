import React from "react";
import { AbsoluteFill, Html5Audio, getStaticFiles, staticFile } from "remotion";
import { Background } from "../../components/Background";
import { FIDES_TAGLINE, Fidi, FidesLogo, PatternCorner, type FidiPose } from "../../components/Fides";
import { alpha, type Brand } from "../../lib/brand";
import { SPRINGS, clamp, enterExit, mix, springAt } from "../../lib/motion";
import { SceneProvider, useScene } from "../../lib/scene";
import type { Timeline } from "../../lib/timeline";
import brandJson from "./brand.json";
import karaokeJson from "./karaoke.json";
import timelineJson from "./timeline.json";

export const SLUG = "ielts-famous-person";
export const timeline = timelineJson as Timeline;
const brand = brandJson as Brand;

type Word = { w: string; s: number; e: number };
type Vocab = { en: string; vi: string; at: number; t: number };
type Section = { id: string; heading: string | null; start: number; voiceStart: number; end: number; exit: number; words: Word[]; vocab: Vocab[] };
const K = karaokeJson as unknown as { title: string; kicker: string; topic: string; total: number; outroAt: number; sections: Section[] };

const FIDI_POSE: Record<string, FidiPose> = { p1: "main", p2: "thinking", p3: "idea", p4: "teach", p5: "study" };
const CUE_CARD = ["Who he/she is", "How you knew him/her", "How/where you would like to meet", "Why you would like to meet"];

/** Index of the word being spoken at time t (-1 before the first word). */
const currentWord = (words: Word[], t: number) => {
  let i = -1;
  for (let k = 0; k < words.length; k++) if (t >= words[k].s) i = k;
  return i;
};

/** Karaoke paragraph: spoken words in the base colour, the live word on a highlight, the rest dimmed. */
const Karaoke: React.FC<{
  words: Word[];
  size: number;
  upcoming: string;
  spoken: string;
  live: string;
  liveInk: string;
  weight?: number;
  align?: "left" | "center";
  lineHeight?: number;
  transform?: "uppercase";
}> = ({ words, size, upcoming, spoken, live, liveInk, weight = 500, align = "left", lineHeight = 1.5, transform }) => {
  const { t, u } = useScene();
  const cur = currentWord(words, t);
  return (
    <div style={{ fontSize: size * u, fontWeight: weight, lineHeight, textAlign: align, textTransform: transform, textWrap: "pretty" }}>
      {words.map((w, i) => {
        const isLive = i === cur && t < w.e + 0.35;
        const p = isLive ? springAt(t - w.s, SPRINGS.snappy) : 1;
        return (
          <React.Fragment key={i}>
            <span
              style={{
                display: "inline-block",
                color: isLive ? liveInk : i <= cur ? spoken : upcoming,
                background: isLive ? live : "transparent",
                borderRadius: 0.2 * size * u,
                padding: `0 ${0.22 * size * u}px`,
                margin: `0 ${-0.22 * size * u}px`,
                transform: isLive ? `scale(${mix(0.94, 1.07, clamp(p))})` : "none",
                transformOrigin: "50% 60%",
                boxShadow: isLive ? `0 ${0.12 * size * u}px ${0.4 * size * u}px ${alpha(live, 0.45)}` : "none",
              }}
            >
              {w.w}
            </span>
            {i < words.length - 1 ? " " : ""}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const Intro: React.FC<{ s: Section }> = ({ s }) => {
  const { t, u, brand: b, width, height } = useScene();
  const c = b.colors;
  const p = enterExit(t, s.start, s.exit, SPRINGS.card, SPRINGS.snappy);
  const words = s.words.slice(2); // title only; "Topic 1:" is shown as a pill
  const chipsAt = s.start + 1.4;
  return (
    <AbsoluteFill style={{ opacity: clamp(p * 1.5) }}>
      <div style={{ position: "absolute", left: 0.07 * width, width: 0.86 * width, top: 0.2 * height, transform: `translateY(${mix(60, 0, p) * u}px)` }}>
        <div style={{ display: "inline-block", background: c.accent, color: c.onAccent, fontWeight: 700, fontSize: 40 * u, padding: `${14 * u}px ${34 * u}px`, borderRadius: 999, marginBottom: 36 * u }}>
          {K.topic}
        </div>
        <div style={{ color: c.muted, fontWeight: 600, fontSize: 30 * u, letterSpacing: 5 * u, textTransform: "uppercase", marginBottom: 28 * u }}>{K.kicker}</div>
        <Karaoke words={words} size={84} weight={800} lineHeight={1.12} upcoming={c.muted} spoken={c.text} live={c.accent} liveInk={c.onAccent} transform="uppercase" />
      </div>
      <div style={{ position: "absolute", left: 0.07 * width, width: 0.86 * width, top: 0.58 * height, display: "flex", flexDirection: "column", gap: 18 * u }}>
        <div style={{ color: c.muted, fontWeight: 600, fontSize: 30 * u, letterSpacing: 4 * u, textTransform: "uppercase", opacity: clamp((t - chipsAt) * 3) }}>You should say</div>
        {CUE_CARD.map((line, i) => {
          const q = springAt(t - (chipsAt + 0.12 + i * 0.12), SPRINGS.card);
          return (
            <div key={line} style={{ alignSelf: "flex-start", background: c.surface, color: c.text, fontWeight: 600, fontSize: 38 * u, padding: `${16 * u}px ${32 * u}px`, borderRadius: 999, opacity: clamp(q * 2), transform: `translateX(${mix(-80, 0, q) * u}px)` }}>
              {line}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const Lesson: React.FC<{ s: Section }> = ({ s }) => {
  const { t, u, brand: b, width, height } = useScene();
  const c = b.colors;
  const p = enterExit(t, s.start, s.exit, SPRINGS.card, SPRINGS.snappy);
  const head = springAt(t - s.start, SPRINGS.card);
  const card = springAt(t - (s.start + 0.12), SPRINGS.card);
  const chars = s.words.reduce((n, w) => n + w.w.length + 1, 0);
  // Fit the paragraph to the card height left over after the vocab list.
  const innerW = 0.9 * width - 2 * 44 * u;
  const cardH = (1130 - s.vocab.length * 92) * u;
  const size = Math.max(32, Math.min(52, Math.sqrt((cardH * innerW) / (chars * 0.5 * 1.5)) / u));
  return (
    <AbsoluteFill style={{ opacity: clamp(p * 2) }}>
      <div style={{ position: "absolute", left: 0.05 * width, width: 0.9 * width, top: 0.125 * height, display: "flex", flexDirection: "column", gap: 28 * u }}>
        <div style={{ background: c.accent, color: c.onAccent, fontWeight: 800, fontSize: 52 * u, textAlign: "center", padding: `${22 * u}px ${24 * u}px`, borderRadius: 999, opacity: clamp(head * 2), transform: `translateY(${mix(-60, 0, head) * u}px)` }}>
          {s.heading}
        </div>
        <div style={{ background: c.text, border: `${6 * u}px solid ${c.accent2}`, borderRadius: b.radius.card * u, padding: `${40 * u}px ${44 * u}px`, boxShadow: `0 ${16 * u}px ${48 * u}px ${alpha(c.surface, 0.35)}`, opacity: clamp(card * 2), transform: `translateY(${mix(90, 0, card) * u}px)` }}>
          <Karaoke words={s.words} size={size} upcoming={alpha(c.surface, 0.5)} spoken={c.bg} live={c.accent} liveInk={c.onAccent} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 * u }}>
          {s.vocab.map((v) => {
            const q = springAt(t - v.t, SPRINGS.card);
            return (
              <div key={v.en} style={{ display: q > 0.001 ? "block" : "none", background: c.surface, borderRadius: 24 * u, padding: `${12 * u}px ${28 * u}px`, fontSize: 29 * u, lineHeight: 1.3, color: c.muted, opacity: clamp(q * 2), transform: `translateX(${mix(-70, 0, q) * u}px)` }}>
                <span style={{ color: c.accent, fontWeight: 800 }}>{v.en}</span>
                <span style={{ opacity: 0.6 }}> : </span>
                <span style={{ color: c.text, fontWeight: 500 }}>{v.vi}</span>
              </div>
            );
          })}
        </div>
      </div>
      {FIDI_POSE[s.id] ? <Fidi pose={FIDI_POSE[s.id]} enterAt={s.start + 0.35} exitAt={s.exit} size={190} x={0.87} y={0.066} /> : null}
    </AbsoluteFill>
  );
};

const Outro: React.FC = () => {
  const { t, u, brand: b, width, height } = useScene();
  const c = b.colors;
  const at = K.outroAt;
  const a = springAt(t - at, SPRINGS.card);
  const q = springAt(t - (at + 0.5), SPRINGS.bouncy);
  return (
    <AbsoluteFill style={{ opacity: clamp(a * 2) }}>
      <PatternCorner corner="tr" opacity={0.55} size={820} />
      <Fidi pose="great" enterAt={at} size={720} x={0.5} y={0.4} />
      <div style={{ position: "absolute", left: 0.07 * width, width: 0.86 * width, top: 0.64 * height, textAlign: "center", color: c.text, fontWeight: 800, fontSize: 64 * u, lineHeight: 1.2, opacity: clamp(a * 2), transform: `translateY(${mix(40, 0, a) * u}px)` }}>
        {FIDES_TAGLINE}
      </div>
      <div style={{ position: "absolute", left: 0.5 * width, top: 0.76 * height, transform: `translate(-50%, -50%) scale(${mix(0.8, 1, q)})`, opacity: clamp(q * 2), background: c.accent, color: c.onAccent, fontWeight: 800, fontSize: 44 * u, padding: `${24 * u}px ${52 * u}px`, borderRadius: 999, whiteSpace: "nowrap" }}>
        Follow for more IELTS Speaking
      </div>
    </AbsoluteFill>
  );
};

const Scene: React.FC = () => {
  const { t, body } = useScene();
  const intro = K.sections[0];
  const energy = clamp(Math.sin(t * 0.6) * 0.5 + 0.5) * 0.3;
  return (
    <AbsoluteFill style={{ fontFamily: body }}>
      <Background energy={energy} />
      <FidesLogo enterAt={0.1} y={0.065} size={74} />
      <Intro s={intro} />
      {K.sections.slice(1).map((s) => (
        <Lesson key={s.id} s={s} />
      ))}
      <Outro />
    </AbsoluteFill>
  );
};

const audioPath = `${SLUG}/audio.wav`;

export const Component: React.FC = () => (
  <SceneProvider brand={brand} timeline={timeline}>
    <Scene />
    {getStaticFiles().some((f) => f.name === audioPath) ? <Html5Audio src={staticFile(audioPath)} /> : null}
  </SceneProvider>
);
