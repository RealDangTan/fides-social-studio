import React from "react";
import { AbsoluteFill, Html5Audio, Img, getStaticFiles, staticFile } from "remotion";
import { getLength, getPointAtLength, getTangentAtLength } from "@remotion/paths";
import { icons } from "lucide-react";
import { Background } from "../../components/Background";
import { Headline, Kicker } from "../../components/Headline";
import { alpha, type Brand } from "../../lib/brand";
import { SPRINGS, clamp, drift, ease, hash, mix, progress, springAt, tween, type SpringPreset } from "../../lib/motion";
import { SceneProvider, useScene } from "../../lib/scene";
import type { Timeline } from "../../lib/timeline";
import brandJson from "./brand.json";
import contentJson from "./content.json";
import timelineJson from "./timeline.json";

export const SLUG = "abc-airfryer";
export const timeline = timelineJson as Timeline;
const brand = brandJson as unknown as Brand;
const C = brand.colors;
const I = brandJson.illus;
const content = contentJson;
type IconName = keyof typeof icons;

// Educational explainer, 53 s, five acts (120 BPM, 2 beats/s):
//   0-5.5s    hook      chicken frying in a pan, droplets freeze mid-air, the question lands
//   6-17.5s   tech      real product -> scan line reveals a cross-section, hot air loops around the food
//   18-29.5s  benefits  three vignettes in a round window: golden chicken, fries from the basket, family table
//   30-40.5s  choose    product centre, four buying criteria pop in and get checked
//   41-53s    brand     modern kitchen, product on the counter, slogan, ABC logo, CTA
// The product photo is the client's own (white backdrop removed by scripts/cutout.mjs);
// every other object is drawn as flat 2D illustration so the product is never redrawn.

// ---------- helpers ----------
const hexRgb = (h: string) => {
  const n = h.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
};
const mixHex = (a: string, b: string, p: number) => {
  const A = hexRgb(a);
  const B = hexRgb(b);
  const q = clamp(p);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * q).toString(16).padStart(2, "0")).join("");
};
const ramp = (stops: string[], p: number) => {
  const q = clamp(p) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(q));
  return mixHex(stops[i], stops[i + 1], q - i);
};
const frac = (v: number) => v - Math.floor(v);
const SOFT: SpringPreset = { settle: 0.8, overshoot: 0 };

const Icon: React.FC<{ name: string; size: number; color: string; stroke?: number }> = ({ name, size, color, stroke = 2.2 }) => {
  const Cmp = icons[name as IconName];
  return Cmp ? <Cmp size={size} color={color} strokeWidth={stroke} /> : null;
};

/** Where things go in each format. Portrait is the primary (social) cut. */
const useLayout = () => {
  const { portrait, width, height, u } = useScene();
  if (portrait) {
    return {
      stage: { x: 0.5 * width, y: 0.535 * height, size: 1000 * u },
      align: "center" as const,
      kicker: { x: 0.5, y: 0.105 },
      title: { x: 0.5, y: 0.185, maxWidth: 0.9, size: 84 },
    };
  }
  return {
    stage: { x: 0.29 * width, y: 0.52 * height, size: 900 * u },
    align: "left" as const,
    kicker: { x: 0.56, y: 0.24 },
    title: { x: 0.56, y: 0.37, maxWidth: 0.38, size: 76 },
  };
};

/** Square illustration area; children draw in a 1000 x 1000 SVG space. */
const Stage: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => {
  const L = useLayout();
  const s = L.stage.size;
  return (
    <div style={{ position: "absolute", left: L.stage.x - s / 2, top: L.stage.y - s / 2, width: s, height: s, ...style }}>{children}</div>
  );
};
const Svg: React.FC<{ children: React.ReactNode; overflow?: boolean; style?: React.CSSProperties }> = ({ children, overflow, style }) => (
  <svg viewBox="0 0 1000 1000" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: overflow ? "visible" : "hidden", ...style }}>
    {children}
  </svg>
);

/** An act: rendered from `from`, leaves at `to` with a quick push + blur. */
const SceneWrap: React.FC<{ from: number; to: number; children: React.ReactNode }> = ({ from, to, children }) => {
  const { t, u } = useScene();
  if (t < from || t > to + 0.5) return null;
  const out = tween(t, to, 0.45, ease.inCubic);
  return (
    <AbsoluteFill style={{ opacity: 1 - out, transform: `scale(${1 + 0.05 * out})`, filter: out > 0 ? `blur(${out * 10 * u}px)` : undefined }}>
      {children}
    </AbsoluteFill>
  );
};

const Title: React.FC<{ text: string; enterAt: number; exitAt?: number | null; y?: number; size?: number }> = ({ text, enterAt, exitAt = null, y, size }) => {
  const L = useLayout();
  return (
    <Headline
      text={text}
      enterAt={enterAt}
      exitAt={exitAt}
      size={size ?? L.title.size}
      x={L.title.x}
      y={y ?? L.title.y}
      maxWidth={L.title.maxWidth}
      align={L.align}
      lineHeight={1.16}
      weight={800}
    />
  );
};

/** The client's product photo (cut-out). Positions and size in px. */
const Product: React.FC<{ x: number; y: number; size: number; enterAt: number; from?: { dx?: number; dy?: number; scale?: number }; float?: boolean }> = ({
  x,
  y,
  size,
  enterAt,
  from = {},
  float = true,
}) => {
  const { t, u } = useScene();
  const p = springAt(t - enterAt, SPRINGS.hero);
  if (p <= 0) return null;
  const dy = (from.dy ?? 120) * u * (1 - p) + (float ? drift(t, 6 * u, 4.6) : 0);
  const dx = (from.dx ?? 0) * u * (1 - p);
  return (
    <Img
      src={staticFile(content.images.product.src)}
      style={{
        position: "absolute",
        left: x - size / 2 + dx,
        top: y - size / 2 + dy,
        width: size,
        height: size,
        opacity: clamp(p * 1.6),
        transform: `scale(${mix(from.scale ?? 0.88, 1, p)})`,
        filter: `drop-shadow(0 ${24 * u}px ${36 * u}px ${alpha(I.shadow, 0.16)})`,
      }}
    />
  );
};

// ---------- food illustrations (all in local SVG units) ----------
const MEAT =
  "M -112 0 C -112 -72, -22 -80, 38 -40 C 66 -22, 86 -15, 100 -12 L 100 12 C 86 15, 66 22, 38 40 C -22 80, -112 72, -112 0 Z";

const Drumstick: React.FC<{ id: string; x: number; y: number; s?: number; rot?: number; done: number; seed?: number }> = ({
  id,
  x,
  y,
  s = 1,
  rot = 0,
  done,
  seed = 1,
}) => {
  const top = ramp([I.rawMeat, I.crustLight, I.crust], done);
  const bottom = ramp([I.rawMeatDeep, I.crust, I.crustDeep], done);
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0.15" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
      </defs>
      <rect x={92} y={-10} width={36} height={20} rx={6} fill={I.bone} />
      <circle cx={134} cy={-11} r={13} fill={I.bone} stroke={I.boneShade} strokeWidth={2} />
      <circle cx={134} cy={11} r={13} fill={I.bone} stroke={I.boneShade} strokeWidth={2} />
      <path d={MEAT} fill={`url(#${id}-g)`} stroke={alpha(I.crustDeep, 0.25)} strokeWidth={3} />
      {Array.from({ length: 9 }, (_, i) => (
        <ellipse
          key={i}
          cx={-90 + 120 * hash(seed * 31 + i)}
          cy={-42 + 84 * hash(seed * 17 + i + 5)}
          rx={5 + 7 * hash(seed + i * 3)}
          ry={3 + 4 * hash(seed + i * 7)}
          fill={i % 3 === 0 ? I.crustLight : I.crustDeep}
          opacity={(i % 3 === 0 ? 0.55 : 0.3) * clamp(done * 1.4 - 0.3)}
        />
      ))}
      <ellipse cx={-48} cy={-36} rx={40} ry={11} transform="rotate(-14 -48 -36)" fill={I.white} opacity={0.32} />
    </g>
  );
};

const Fry: React.FC<{ x: number; y: number; len?: number; rot?: number; anchor?: "base" | "center" }> = ({ x, y, len = 150, rot = 0, anchor = "center" }) => {
  const y0 = anchor === "base" ? -len : -len / 2;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect x={-12} y={y0} width={24} height={len} rx={7} fill={I.fry} stroke={alpha(I.fryDeep, 0.8)} strokeWidth={3} />
      <rect x={-12} y={y0} width={24} height={16} rx={7} fill={I.fryDeep} opacity={0.75} />
      <rect x={-6} y={y0 + 22} width={5} height={len - 44} rx={2.5} fill={I.white} opacity={0.35} />
    </g>
  );
};

const Leaf: React.FC<{ x: number; y: number; s?: number; rot?: number }> = ({ x, y, s = 1, rot = 0 }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
    <path d="M 0 0 C 30 -46, 100 -46, 130 0 C 100 36, 30 36, 0 0 Z" fill={I.leaf} />
    <path d="M 8 0 L 118 0" stroke={mixHex(I.leaf, I.white, 0.35)} strokeWidth={4} strokeLinecap="round" />
  </g>
);

const Tomato: React.FC<{ x: number; y: number; r?: number }> = ({ x, y, r = 28 }) => (
  <g transform={`translate(${x} ${y})`}>
    <circle r={r} fill={I.tomato} />
    <circle r={r * 0.72} fill={mixHex(I.tomato, I.white, 0.3)} />
    {[0, 1, 2, 3, 4].map((k) => (
      <ellipse key={k} cx={Math.cos(k * 1.256) * r * 0.42} cy={Math.sin(k * 1.256) * r * 0.42} rx={3.5} ry={2.2} fill={I.bone} />
    ))}
  </g>
);

const Steam: React.FC<{ x: number; y: number; t: number; phase?: number; s?: number; color?: string }> = ({ x, y, t, phase = 0, s = 1, color = I.steam }) => {
  const local = frac(t / 2.4 + phase);
  return (
    <path
      d="M 0 0 C 18 -30, -18 -60, 0 -90 C 18 -120, -10 -140, 0 -170"
      transform={`translate(${x} ${y - local * 70 * s}) scale(${s})`}
      fill="none"
      stroke={color}
      strokeWidth={10}
      strokeLinecap="round"
      opacity={Math.sin(Math.PI * local) * 0.75}
    />
  );
};

const Sparkle: React.FC<{ x: number; y: number; t: number; phase: number; s?: number }> = ({ x, y, t, phase, s = 1 }) => {
  const k = Math.max(0, Math.sin((t / 1.6 + phase) * Math.PI * 2));
  return (
    <path
      d="M 0 -22 C 3 -4, 4 -3, 22 0 C 4 3, 3 4, 0 22 C -3 4, -4 3, -22 0 C -4 -3, -3 -4, 0 -22 Z"
      transform={`translate(${x} ${y}) scale(${s * k})`}
      fill={I.white}
    />
  );
};

const Drop: React.FC<{ x: number; y: number; s: number; fill?: string; dashed?: boolean }> = ({ x, y, s, fill, dashed }) => (
  <path
    d="M 0 -50 C 20 -20, 36 0, 36 18 A 36 36 0 0 1 -36 18 C -36 0, -20 -20, 0 -50 Z"
    transform={`translate(${x} ${y}) scale(${s})`}
    fill={fill ?? "none"}
    stroke={dashed ? alpha(I.oilDeep, 0.7) : alpha(I.oilDeep, 0.9)}
    strokeWidth={(dashed ? 3 : 2.5) / s}
    strokeDasharray={dashed ? `${8 / s} ${7 / s}` : undefined}
  />
);

// ---------- Act 1: hook ----------
const HookScene: React.FC = () => {
  const { t, at, portrait } = useScene();
  const fz = at("freeze");
  const pt = Math.min(t, fz); // physics time stops at the freeze-frame
  const settle = tween(t, fz, 0.35);
  const flash = t >= fz ? 1 - tween(t, fz, 0.45, ease.outCubic) : 0;
  const bracket = springAt(t - fz - 0.05, SPRINGS.snappy);
  const push = 1 + 0.06 * ease.inOutCubic(progress(t, 0, at("hook-out") + 0.5));
  const cx = 500;
  const cy = 548;
  const inOil = (x: number, y: number) => ((x - 500) / 370) ** 2 + ((y - 560) / 142) ** 2 < 0.9;

  const bubbles = Array.from({ length: 30 }, (_, i) => {
    const P = 0.45 + 0.55 * hash(i + 1);
    const local = frac(pt / P + hash(i + 51));
    const ang = hash(i + 101) * Math.PI * 2;
    const rad = 150 + 200 * hash(i + 151);
    const x = cx + Math.cos(ang) * rad * 1.05;
    const y = cy + 16 + Math.sin(ang) * rad * 0.36;
    return { x, y, r: (4 + 10 * hash(i + 201)) * Math.sin(Math.PI * local), front: Math.sin(ang) > 0 };
  }).filter((b) => inOil(b.x, b.y));

  const drops = Array.from({ length: 22 }, (_, i) => {
    const P = 0.85 + 0.5 * hash(i + 301);
    const tau = frac(pt / P + hash(i + 351)) * P;
    const a = hash(i + 401) * Math.PI * 2;
    const ox = cx + Math.cos(a) * (110 + 100 * hash(i + 451));
    const oy = cy + 10 + Math.sin(a) * 45;
    const vx = Math.cos(a) * (140 + 260 * hash(i + 501));
    const vy = -(560 + 420 * hash(i + 551));
    const g = 1700;
    const x = ox + vx * tau;
    const y = oy + vy * tau + 0.5 * g * tau * tau;
    const vyt = vy + g * tau;
    return {
      x,
      y,
      r: 5 + 8 * hash(i + 601),
      ang: (Math.atan2(vyt, vx) * 180) / Math.PI,
      stretch: Math.min(2.4, 1 + Math.hypot(vx, vyt) * 0.0015),
      visible: y < oy - 4,
    };
  });

  const corners = [
    [330, 425, 1, 1],
    [670, 425, -1, 1],
    [330, 685, 1, -1],
    [670, 685, -1, -1],
  ];
  const bs = mix(1.3, 1, bracket);

  return (
    <SceneWrap from={-1} to={at("hook-out")}>
      <Stage style={{ transform: `scale(${push})`, filter: `saturate(${1 - 0.3 * settle})` }}>
        <Svg overflow>
          <defs>
            <radialGradient id="hk-oil" cx="0.45" cy="0.4" r="0.65">
              <stop offset="0" stopColor={I.oilLight} />
              <stop offset="0.55" stopColor={I.oil} />
              <stop offset="1" stopColor={I.oilDeep} />
            </radialGradient>
            <linearGradient id="hk-pan" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={I.pan} />
              <stop offset="0.5" stopColor={I.panRim} />
              <stop offset="1" stopColor={I.pan} />
            </linearGradient>
            <clipPath id="hk-meat">
              <path d={MEAT} transform={`translate(${cx} ${cy}) rotate(-12) scale(1.15)`} />
            </clipPath>
          </defs>
          <ellipse cx={500} cy={770} rx={430} ry={60} fill={alpha(I.shadow, 0.12)} />
          <rect x={850} y={498} width={92} height={44} rx={22} transform="rotate(-14 850 520)" fill={I.pan} />
          <path d="M 100 560 C 112 705, 255 752, 500 752 C 745 752, 888 705, 900 560 Z" fill="url(#hk-pan)" />
          <ellipse cx={500} cy={560} rx={400} ry={165} fill={I.panRim} />
          <ellipse cx={500} cy={562} rx={386} ry={154} fill={I.pan} />
          <ellipse cx={500} cy={566} rx={372} ry={144} fill="url(#hk-oil)" />
          {[0, 1, 2].map((k) => (
            <ellipse
              key={k}
              cx={330 + k * 170 + drift(pt, 30, 3 + k, k)}
              cy={505 + k * 22}
              rx={70 - k * 12}
              ry={10}
              fill={I.white}
              opacity={0.22}
            />
          ))}
          {[0, 1, 2].map((k) => {
            const l = frac(pt / 1.4 + k / 3);
            return (
              <ellipse key={k} cx={cx} cy={cy + 20} rx={170 + 150 * l} ry={(170 + 150 * l) * 0.34} fill="none" stroke={I.oilLight} strokeWidth={4} opacity={0.6 * (1 - l)} />
            );
          })}
          {bubbles
            .filter((b) => !b.front)
            .map((b, i) => (
              <circle key={i} cx={b.x} cy={b.y} r={Math.max(0, b.r)} fill={alpha(I.oilLight, 0.45)} stroke={I.oilLight} strokeWidth={2.5} />
            ))}
          <Drumstick id="hk-ck" x={cx} y={cy} s={1.15} rot={-12} done={0.5} seed={3} />
          <ellipse cx={500} cy={655} rx={330} ry={95} fill={I.oil} opacity={0.42} clipPath="url(#hk-meat)" />
          {bubbles
            .filter((b) => b.front)
            .map((b, i) => (
              <circle key={i} cx={b.x} cy={b.y} r={Math.max(0, b.r)} fill={alpha(I.oilLight, 0.45)} stroke={I.oilLight} strokeWidth={2.5} />
            ))}
          {drops
            .filter((d) => d.visible)
            .map((d, i) => (
              <g key={i} transform={`translate(${d.x} ${d.y}) rotate(${d.ang})`}>
                <ellipse rx={d.r * d.stretch} ry={d.r} fill={I.oil} />
                <circle cx={d.r * 0.3} cy={-d.r * 0.3} r={d.r * 0.35} fill={I.white} opacity={0.7} />
              </g>
            ))}
          {bracket > 0.001 ? (
            <g opacity={clamp(bracket * 1.5)} transform={`translate(500 555) scale(${bs}) translate(-500 -555)`}>
              {corners.map(([x, y, sx, sy], i) => (
                <path key={i} d={`M ${x} ${y + 56 * sy} L ${x} ${y} L ${x + 56 * sx} ${y}`} fill="none" stroke={C.text} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
              ))}
            </g>
          ) : null}
        </Svg>
      </Stage>
      <Kicker text={content.hook.kicker} enterAt={0.15} exitAt={at("question-in") - 0.15} x={portrait ? 0.5 : 0.56} y={portrait ? 0.105 : 0.3} align={portrait ? "center" : "left"} />
      {flash > 0 ? <AbsoluteFill style={{ backgroundColor: C.surface, opacity: flash * 0.65 }} /> : null}
      <Title text={content.hook.question} enterAt={at("question-in")} exitAt={at("hook-out")} size={portrait ? 86 : 72} y={portrait ? 0.175 : 0.5} />
    </SceneWrap>
  );
};

// ---------- Act 2: how it works ----------
const airPath = (m: 1 | -1) => {
  const X = (x: number) => (m === 1 ? x : 1000 - x);
  return [
    `M ${X(470)} 298`,
    `C ${X(380)} 290, ${X(300)} 300, ${X(300)} 380`,
    `L ${X(300)} 716`,
    `C ${X(300)} 790, ${X(370)} 800, ${X(425)} 770`,
    `C ${X(470)} 745, ${X(480)} 700, ${X(462)} 640`,
    `C ${X(440)} 570, ${X(392)} 555, ${X(405)} 500`,
    `C ${X(418)} 440, ${X(462)} 420, ${X(485)} 372`,
  ].join(" ");
};
const AIR = [airPath(1), airPath(-1)];
const COIL = (() => {
  const pts: string[] = [];
  for (let i = 0; i <= 120; i++) {
    const x = 292 + (416 * i) / 120;
    pts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${(320 + 13 * Math.sin((i / 120) * Math.PI * 2 * 10)).toFixed(1)}`);
  }
  return pts.join(" ");
})();

const AirLoop: React.FC<{ d: string; p: number; local: number; seed: number }> = ({ d, p, local, seed }) => {
  const len = getLength(d);
  return (
    <g opacity={clamp(p * 1.4)}>
      <path d={d} fill="none" stroke={alpha(I.air, 0.25)} strokeWidth={9} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - p)} />
      <path d={d} fill="none" stroke={I.air} strokeWidth={9} strokeLinecap="round" strokeDasharray="44 120" strokeDashoffset={-local * 230} opacity={0.85 * p} />
      {[0, 1, 2, 3].map((k) => {
        const s = frac(local * 0.3 + k / 4 + seed) * len;
        if (s > len * p) return null;
        const pt = getPointAtLength(d, s);
        const tg = getTangentAtLength(d, s);
        if (!pt || !tg) return null;
        return (
          <polygon
            key={k}
            points="-18,-15 14,0 -18,15 -10,0"
            fill={I.heat}
            transform={`translate(${pt.x} ${pt.y}) rotate(${(Math.atan2(tg.y, tg.x) * 180) / Math.PI})`}
          />
        );
      })}
    </g>
  );
};

const TechScene: React.FC = () => {
  const { t, at, u, portrait, width, height, display, body } = useScene();
  const L = useLayout();
  const tin = at("cut-in");
  const tcut = at("cutaway");
  const theat = at("heat-on");
  const tair = at("air-on");
  const tcmp = at("compare-in");
  const tout = at("tech-out");
  const enter = springAt(t - tin, SPRINGS.hero);
  const scan = tween(t, tcut, 1.0, ease.inOutCubic);
  const heatP = tween(t, theat, 0.9, ease.outCubic);
  const airP = tween(t, tair, 1.0, ease.outCubic);
  const done = 0.12 + 0.88 * tween(t, tair + 0.6, 8, ease.inOutCubic);
  const shrink = springAt(t - tcmp, SPRINGS.glide);
  const B = content.images.product.bbox;
  const scanY = mix(B.y0 * 1000 - 12, B.y1 * 1000 + 12, scan);
  const tau = Math.max(0, t - theat);
  const fanRot = 1100 * (tau - 0.6 * (1 - Math.exp(-tau / 0.6)));
  const blades = Array.from({ length: 6 }, (_, k) => {
    const a = ((fanRot + k * 60) * Math.PI) / 180;
    return { x: 500 + 92 * Math.cos(a), w: 10 + 26 * Math.abs(Math.sin(a)), front: Math.sin(a) > 0 };
  });

  const stageMove = portrait
    ? `translateY(${(140 * (1 - enter) - 135 * shrink) * u}px) scale(${mix(0.86, 1, enter) * mix(1, 0.78, shrink)})`
    : `translateY(${140 * (1 - enter) * u}px) scale(${mix(0.86, 1, enter) * mix(1, 0.94, shrink)})`;

  // Comparison cards
  const cardW = (portrait ? 452 : 362) * u;
  const cardsY = portrait ? 0.765 * height : 0.66 * height;
  const cardX = (i: number) => (portrait ? 0.5 * width + (i === 0 ? -1 : 1) * 242 * u : 0.56 * width + cardW / 2 + i * (cardW + 26 * u));
  const cards = [
    { ...content.tech.deep, big: true },
    { ...content.tech.air, big: false },
  ];

  return (
    <SceneWrap from={tin - 0.05} to={tout}>
      <Stage style={{ transform: stageMove, opacity: clamp(enter * 1.6) }}>
        <Img
          src={staticFile(content.images.product.src)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", clipPath: `inset(${scanY / 10}% 0 0 0)` }}
        />
        <Svg style={{ clipPath: `inset(0 0 ${100 - scanY / 10}% 0)` }}>
          <defs>
            <linearGradient id="ct-shell" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={I.shell} />
              <stop offset="0.5" stopColor={I.shellLight} />
              <stop offset="1" stopColor={I.shell} />
            </linearGradient>
            <filter id="ct-blur" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={12} />
            </filter>
          </defs>
          <rect x={212} y={146} width={576} height={728} rx={82} fill="url(#ct-shell)" />
          <rect x={262} y={222} width={476} height={590} rx={46} fill={I.shellInner} />
          <rect x={262} y={222} width={476} height={590} rx={46} fill="none" stroke={alpha(I.shadow, 0.12)} strokeWidth={6} />
          {/* fan */}
          <rect x={386} y={236} width={228} height={36} rx={18} fill={alpha(I.shellLight, 0.35)} />
          {blades
            .filter((b) => !b.front)
            .map((b, k) => (
              <rect key={`b${k}`} x={b.x - b.w / 2} y={242} width={b.w} height={24} rx={6} fill={I.shellLight} />
            ))}
          <circle cx={500} cy={254} r={15} fill={I.shell} />
          {blades
            .filter((b) => b.front)
            .map((b, k) => (
              <rect key={`f${k}`} x={b.x - b.w / 2} y={242} width={b.w} height={24} rx={6} fill={I.shell} />
            ))}
          {/* heater */}
          <ellipse cx={500} cy={345} rx={240} ry={70} fill={I.heatGlow} opacity={0.3 * heatP} filter="url(#ct-blur)" />
          <path d={COIL} fill="none" stroke={I.heatGlow} strokeWidth={34} strokeLinecap="round" opacity={heatP * (0.5 + 0.15 * Math.sin(t * 7))} filter="url(#ct-blur)" />
          <path d={COIL} fill="none" stroke={mixHex(I.shellLight, I.heat, heatP)} strokeWidth={11} strokeLinecap="round" />
          {/* basket */}
          <polygon points="318,468 682,468 664,742 336,742" fill={alpha(I.basket, 0.1)} />
          {Array.from({ length: 10 }, (_, k) => {
            const x = 345 + k * 34;
            return <line key={k} x1={x} y1={474} x2={x + (500 - x) * 0.05} y2={736} stroke={alpha(I.basket, 0.3)} strokeWidth={3} />;
          })}
          <Drumstick id="ct-a" x={452} y={668} s={0.62} rot={-8} done={done} seed={5} />
          <Drumstick id="ct-b" x={548} y={572} s={0.62} rot={172} done={done} seed={9} />
          <polygon points="318,468 682,468 664,742 336,742" fill="none" stroke={I.basket} strokeWidth={10} strokeLinejoin="round" />
          <line x1={340} y1={742} x2={660} y2={742} stroke={I.basket} strokeWidth={6} strokeDasharray="10 9" />
          {/* hot air */}
          {AIR.map((d, i) => (
            <AirLoop key={i} d={d} p={airP} local={Math.max(0, t - tair)} seed={i * 0.12} />
          ))}
        </Svg>
        {scan > 0 && scan < 1 ? (
          <div
            style={{
              position: "absolute",
              left: `${B.x0 * 100 - 4}%`,
              width: `${(B.x1 - B.x0) * 100 + 8}%`,
              top: `${scanY / 10}%`,
              height: 6 * u,
              marginTop: -3 * u,
              borderRadius: 3 * u,
              background: C.accent2,
              boxShadow: `0 0 ${24 * u}px ${8 * u}px ${alpha(C.accent2, 0.45)}`,
            }}
          />
        ) : null}
      </Stage>

      <Kicker text={content.tech.kicker} enterAt={tin + 0.4} exitAt={tout} x={L.kicker.x} y={L.kicker.y} align={L.align} />
      <Title text={content.tech.title} enterAt={at("air-label")} exitAt={tout} />

      {cards.map((c, i) => {
        const p = springAt(t - (tcmp + 0.15 + i * 0.14), SPRINGS.card);
        if (p <= 0) return null;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: cardX(i) - cardW / 2,
              top: cardsY,
              width: cardW,
              transform: `translateY(${-50 + 0}%) translateY(${60 * u * (1 - p)}px) scale(${mix(0.92, 1, p)})`,
              opacity: clamp(p * 1.6),
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: 10 * u,
              padding: `${26 * u}px ${20 * u}px ${28 * u}px`,
              boxSizing: "border-box",
              background: C.surface,
              borderRadius: 28 * u,
              boxShadow: `0 ${18 * u}px ${40 * u}px ${alpha(I.shadow, 0.1)}, 0 0 0 ${2 * u}px ${alpha(c.big ? I.oilDeep : C.accent, 0.25)}`,
            }}
          >
            <svg viewBox="-50 -60 100 120" style={{ width: 80 * u, height: 96 * u, flex: "none" }}>
              {c.big ? (
                <Drop x={0} y={0} s={1.18} fill={I.oil} />
              ) : (
                <>
                  <Drop x={0} y={0} s={1.18} dashed />
                  <Drop x={0} y={22} s={0.45} fill={I.oil} />
                </>
              )}
            </svg>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: display, fontWeight: 800, fontSize: (portrait ? 36 : 30) * u, lineHeight: 1.2, color: C.text, letterSpacing: -0.4 * u, whiteSpace: "nowrap" }}>{c.title}</div>
              <div style={{ fontFamily: body, fontWeight: 500, fontSize: (portrait ? 26 : 20) * u, lineHeight: 1.3, color: C.muted, marginTop: 6 * u, whiteSpace: "nowrap" }}>{c.sub}</div>
            </div>
          </div>
        );
      })}
      {(() => {
        const p = tween(t, tcmp + 0.6, 0.5);
        return (
          <div
            style={{
              position: "absolute",
              left: portrait ? 0.5 * width : 0.56 * width,
              top: portrait ? 0.862 * height : 0.85 * height,
              transform: `translate(${portrait ? "-50%" : "0"}, -50%)`,
              opacity: p,
              fontFamily: body,
              fontWeight: 500,
              fontSize: 26 * u,
              color: C.muted,
              whiteSpace: "nowrap",
            }}
          >
            {content.tech.note}
          </div>
        );
      })()}
    </SceneWrap>
  );
};

// ---------- Act 3: benefits ----------
const ChickenPlate: React.FC<{ lt: number; t: number }> = ({ lt, t }) => {
  const pieces = [
    { x: 420, y: 515, rot: -28 },
    { x: 585, y: 492, rot: 208 },
    { x: 498, y: 612, rot: -6 },
  ];
  return (
    <g transform={`rotate(${drift(t, 2, 7)} 500 540)`}>
      <ellipse cx={500} cy={566} rx={350} ry={256} fill={alpha(I.shadow, 0.08)} />
      <ellipse cx={500} cy={540} rx={340} ry={250} fill={I.plate} />
      <ellipse cx={500} cy={540} rx={282} ry={204} fill="none" stroke={I.plateRim} strokeWidth={5} />
      <Leaf x={300} y={500} s={1.1} rot={-25} />
      <Leaf x={640} y={430} s={1.0} rot={150} />
      <Leaf x={420} y={660} s={0.9} rot={10} />
      <Tomato x={665} y={615} r={32} />
      <Tomato x={330} y={625} r={28} />
      {pieces.map((p, k) => {
        const e = springAt(lt - 0.15 - k * 0.09, SPRINGS.card);
        return (
          <g key={k} opacity={clamp(e * 1.6)} transform={`translate(0 ${-90 * (1 - e)})`}>
            <Drumstick id={`b1-${k}`} x={p.x} y={p.y} s={1.0} rot={p.rot} done={1} seed={11 + k} />
          </g>
        );
      })}
      {[0, 1, 2].map((k) => (
        <Steam key={k} x={430 + k * 70} y={440} t={t} phase={k * 0.33} />
      ))}
      <Sparkle x={395} y={480} t={t} phase={0} s={1.1} />
      <Sparkle x={610} y={470} t={t} phase={0.35} s={0.9} />
      <Sparkle x={520} y={600} t={t} phase={0.7} s={1.0} />
    </g>
  );
};

const FriesBasket: React.FC<{ lt: number; t: number; pourAt: number }> = ({ lt, t, pourAt }) => {
  const rise = springAt(lt - 0.25, { settle: 0.9, overshoot: 0.02 });
  const by = mix(1000, 372, rise);
  const tilt = 38 * ease.inOutCubic(progress(t, pourAt - 0.6, pourAt));
  const fries = Array.from({ length: 11 }, (_, k) => ({
    x: 30 + k * 24,
    len: 196 + 34 * hash(k + 71),
    rot: (hash(k + 91) - 0.5) * 22,
  }));
  const T = 0.5;
  const g = 1700;
  const pour = [7, 9, 5, 8, 6, 10, 4];
  const flights = pour.map((idx, j) => {
    const launch = pourAt + j * 0.09;
    const tau = t - launch;
    const x0 = 505 + (hash(idx) - 0.5) * 24;
    const y0 = 345;
    const tx = 630 + (j - 3) * 24;
    const ty = 642 - 10 * hash(idx + 7);
    const vy = (ty - y0 - 0.5 * g * T * T) / T;
    const restRot = -70 + 140 * hash(idx + 13);
    if (tau < 0) return { idx, state: "basket" as const };
    if (tau < T) {
      const q = tau / T;
      return { idx, state: "air" as const, x: mix(x0, tx, q), y: y0 + vy * tau + 0.5 * g * tau * tau, rot: mix(-30, restRot + 360, q) };
    }
    return { idx, state: "bowl" as const, x: tx, y: ty, rot: restRot };
  });
  const gone = new Set(flights.filter((f) => f.state !== "basket").map((f) => f.idx));
  const landedAt = pourAt + 0.09 * 6 + T;
  return (
    <g>
      {/* bowl back rim, landed fries, bowl body */}
      <ellipse cx={690} cy={662} rx={152} ry={42} fill={I.plateRim} />
      {flights.map((f) => (f.state === "bowl" ? <Fry key={f.idx} x={f.x} y={f.y} len={150} rot={f.rot} /> : null))}
      <path d="M 538 662 C 548 770, 832 770, 842 662 Z" fill={I.plate} />
      <path d="M 538 662 C 548 770, 832 770, 842 662" fill="none" stroke={I.plateRim} strokeWidth={5} />
      <ellipse cx={690} cy={790} rx={150} ry={16} fill={alpha(I.shadow, 0.1)} />
      {t > landedAt ? [0, 1].map((k) => <Steam key={k} x={655 + k * 70} y={600} t={t} phase={k * 0.5} s={0.8} />) : null}
      {/* basket */}
      <g transform={`translate(200 ${by}) rotate(${tilt} 300 0)`}>
        <rect x={-130} y={52} width={146} height={46} rx={23} fill={I.shell} />
        <polygon points="0,0 300,0 284,190 16,190" fill={alpha(I.basket, 0.22)} />
        {fries.map((f, k) => (gone.has(k) ? null : <Fry key={k} x={f.x + 8} y={185} len={f.len} rot={f.rot} anchor="base" />))}
        <polygon points="0,0 300,0 284,190 16,190" fill={alpha(I.basket, 0.55)} />
        {Array.from({ length: 10 }, (_, k) => (
          <line key={k} x1={28 + k * 27} y1={6} x2={30 + k * 26} y2={186} stroke={alpha(I.shell, 0.45)} strokeWidth={3} />
        ))}
        <polygon points="0,0 300,0 284,190 16,190" fill="none" stroke={I.basket} strokeWidth={10} strokeLinejoin="round" />
      </g>
      {flights.map((f) => (f.state === "air" ? <Fry key={`a${f.idx}`} x={f.x} y={f.y} len={150} rot={f.rot} /> : null))}
    </g>
  );
};

const Hand: React.FC<{ side: 1 | -1 }> = ({ side }) => (
  <g transform={`scale(${side} 1)`}>
    <rect x={-300} y={70} width={118} height={560} rx={56} transform="rotate(12 -240 70)" fill={I.sleeve} />
    <ellipse cx={-212} cy={60} rx={50} ry={62} fill={I.skin} />
    {[0, 1, 2, 3].map((k) => (
      <rect key={k} x={-212} y={10 + k * 22} width={58} height={20} rx={10} fill={I.skin} stroke={I.skinDeep} strokeWidth={2} />
    ))}
    <rect x={-236} y={-38} width={26} height={70} rx={13} transform="rotate(-20 -223 -3)" fill={I.skin} stroke={I.skinDeep} strokeWidth={2} />
  </g>
);

const FamilyTable: React.FC<{ lt: number; t: number; landAt: number }> = ({ lt, t, landAt }) => {
  const approach = springAt(lt - 0.15, { settle: 1.0, overshoot: 0 });
  const ty = mix(640, 0, approach);
  const lower = ease.outCubic(progress(t, landAt - 0.5, landAt));
  const sc = mix(1.14, 1, lower);
  const release = springAt(t - (landAt + 0.35), { settle: 0.8, overshoot: 0 });
  const settings = [225, 315, 135, 45];
  return (
    <g>
      <circle cx={500} cy={500} r={445} fill={I.wood} />
      {[0, 1, 2, 3, 4].map((k) => (
        <ellipse key={k} cx={480 + k * 14} cy={500} rx={150 + k * 70} ry={120 + k * 58} fill="none" stroke={alpha(I.woodDeep, 0.22)} strokeWidth={3} />
      ))}
      {settings.map((deg, k) => {
        const a = (deg * Math.PI) / 180;
        const e = springAt(lt - 0.1 - k * 0.07, SPRINGS.card);
        return (
          <g key={k} transform={`translate(${500 + Math.cos(a) * 305} ${500 + Math.sin(a) * 305}) rotate(${deg + 90}) scale(${mix(0.6, 1, e)})`} opacity={clamp(e * 1.6)}>
            <circle r={72} fill={I.plate} stroke={I.plateRim} strokeWidth={4} />
            <circle r={48} fill="none" stroke={I.plateRim} strokeWidth={3} />
            <line x1={98} y1={-70} x2={98} y2={70} stroke={I.woodDeep} strokeWidth={7} strokeLinecap="round" />
            <line x1={112} y1={-68} x2={112} y2={72} stroke={I.woodDeep} strokeWidth={7} strokeLinecap="round" />
            <circle cx={-82} cy={-80} r={24} fill={I.window} stroke={I.plateRim} strokeWidth={3} />
          </g>
        );
      })}
      {/* tray */}
      <g transform={`translate(500 ${520 + ty}) scale(${sc})`}>
        <rect x={-206} y={-118 + 22 * (1 - lower) + 12} width={420} height={280} rx={36} fill={alpha(I.shadow, 0.16 + 0.06 * lower)} />
        <rect x={-210} y={-140} width={420} height={280} rx={36} fill={C.surface} stroke={I.plateRim} strokeWidth={8} />
        <rect x={40} y={-110} width={150} height={120} rx={16} fill={I.napkin} />
        {[-60, -20, 15, 40, 70, -35, 5].map((r, k) => (
          <Fry key={k} x={92 + (k % 4) * 22} y={-52 + Math.floor(k / 4) * 22} len={118} rot={r} />
        ))}
        <Drumstick id="b3-a" x={-100} y={-48} s={0.6} rot={-18} done={1} seed={21} />
        <Drumstick id="b3-b" x={-88} y={58} s={0.6} rot={14} done={1} seed={23} />
        <circle cx={112} cy={78} r={52} fill={I.plate} stroke={I.plateRim} strokeWidth={3} />
        <Leaf x={78} y={74} s={0.42} rot={-20} />
        <Leaf x={100} y={92} s={0.4} rot={-60} />
        <Tomato x={130} y={64} r={14} />
        <circle cx={12} cy={96} r={22} fill={I.plate} stroke={I.plateRim} strokeWidth={3} />
        <circle cx={12} cy={96} r={15} fill={I.tomato} />
        <g transform={`translate(0 ${release * 760})`} opacity={1 - clamp(release * 1.4 - 0.4)}>
          <Hand side={1} />
          <Hand side={-1} />
        </g>
      </g>
      {t > landAt ? [0, 1, 2].map((k) => <Steam key={k} x={430 + k * 70} y={455} t={t} phase={k * 0.31} s={0.8} />) : null}
    </g>
  );
};

const BenefitsScene: React.FC = () => {
  const { t, at, u, portrait } = useScene();
  const L = useLayout();
  const cues = [at("ben-1"), at("ben-2"), at("ben-3")];
  const ends = [at("ben-2"), at("ben-3"), at("ben-out")];
  const disc = springAt(t - cues[0], SPRINGS.card);
  const slide = (i: number) => {
    const inX = i === 0 ? 0 : (1 - springAt(t - cues[i], SOFT)) * 1000;
    const outX = i < 2 ? -1000 * tween(t, ends[i], 0.55, ease.inOutCubic) : 0;
    return inX + outX;
  };
  const views = [
    <ChickenPlate key="a" lt={t - cues[0]} t={t} />,
    <FriesBasket key="b" lt={t - cues[1]} t={t} pourAt={at("fries-pour")} />,
    <FamilyTable key="c" lt={t - cues[2]} t={t} landAt={at("tray-land")} />,
  ];
  return (
    <SceneWrap from={cues[0] - 0.05} to={at("ben-out")}>
      <Stage
        style={{
          transform: `scale(${mix(0.72, 1, disc)})`,
          opacity: clamp(disc * 1.5),
          filter: `drop-shadow(0 ${24 * u}px ${40 * u}px ${alpha(I.shadow, 0.12)})`,
        }}
      >
        <Svg>
          <defs>
            <clipPath id="bn-clip">
              <circle cx={500} cy={500} r={445} />
            </clipPath>
          </defs>
          <circle cx={500} cy={500} r={445} fill={C.bgAlt} />
          <g clipPath="url(#bn-clip)">
            {views.map((v, i) =>
              t >= cues[i] - 0.01 && t < ends[i] + 0.7 ? (
                <g key={i} transform={`translate(${slide(i)} 0)`}>
                  {v}
                </g>
              ) : null,
            )}
          </g>
          <circle cx={500} cy={500} r={441} fill="none" stroke={C.surface} strokeWidth={8} />
        </Svg>
      </Stage>
      {content.benefits.map((b, i) => (
        <React.Fragment key={i}>
          <Kicker text={b.kicker} enterAt={cues[i] + 0.15} exitAt={ends[i] - 0.1} x={L.kicker.x} y={L.kicker.y} align={L.align} />
          <Title text={b.title} enterAt={cues[i] + 0.25} exitAt={ends[i] - 0.1} size={portrait ? (b.title.includes("\n") ? 92 : 112) : 96} y={portrait ? 0.19 : 0.42} />
        </React.Fragment>
      ))}
    </SceneWrap>
  );
};

// ---------- Act 4: choose ----------
const Criterion: React.FC<{ icon: string; label: string; x: number; y: number; enterAt: number; checkAt: number; size: number }> = ({
  icon,
  label,
  x,
  y,
  enterAt,
  checkAt,
  size,
}) => {
  const { t, u, display } = useScene();
  const p = springAt(t - enterAt, SPRINGS.bouncy);
  if (p <= 0) return null;
  const ck = springAt(t - checkAt, SPRINGS.bouncy);
  const s = size * u;
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -${s / 2}px) scale(${mix(0.4, 1, p)})`, opacity: clamp(p * 2), textAlign: "center" }}>
      <div
        style={{
          width: s,
          height: s,
          margin: "0 auto",
          borderRadius: "50%",
          background: C.surface,
          border: `${3 * u}px solid ${alpha(C.accent, 0.3)}`,
          boxShadow: `0 ${14 * u}px ${30 * u}px ${alpha(I.shadow, 0.1)}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          boxSizing: "border-box",
        }}
      >
        <Icon name={icon} size={s * 0.44} color={C.accent} />
        {ck > 0 ? (
          <div
            style={{
              position: "absolute",
              right: -6 * u,
              top: -6 * u,
              width: 50 * u,
              height: 50 * u,
              borderRadius: "50%",
              background: C.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${ck})`,
              boxShadow: `0 0 0 ${4 * u}px ${C.surface}`,
            }}
          >
            <Icon name="Check" size={30 * u} color={C.onAccent} stroke={3.2} />
          </div>
        ) : null}
      </div>
      <div style={{ marginTop: 16 * u, fontFamily: display, fontWeight: 800, fontSize: 34 * u, lineHeight: 1.18, color: C.text, whiteSpace: "pre-line", letterSpacing: -0.4 * u }}>
        {label}
      </div>
    </div>
  );
};

const ChooseScene: React.FC = () => {
  const { t, at, u, portrait, width, height } = useScene();
  const tin = at("choose-in");
  const px = portrait ? 0.5 * width : 0.29 * width;
  const py = portrait ? 0.52 * height : 0.53 * height;
  const size = (portrait ? 640 : 700) * u;
  const ring = tween(t, tin + 0.3, 0.9, ease.outCubic);
  const slots = portrait
    ? [
        [0.185, 0.36],
        [0.815, 0.36],
        [0.185, 0.655],
        [0.815, 0.655],
      ]
    : [
        [0.63, 0.53],
        [0.83, 0.53],
        [0.63, 0.78],
        [0.83, 0.78],
      ];
  const R = (portrait ? 330 : 340) * u;
  return (
    <SceneWrap from={tin - 0.05} to={at("choose-out")}>
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <circle cx={px} cy={py} r={R * mix(0.85, 1, ring)} fill={alpha(C.surface, 0.7 * ring)} />
        <circle
          cx={px}
          cy={py}
          r={R * mix(0.85, 1, ring)}
          fill="none"
          stroke={alpha(C.accent, 0.4 * ring)}
          strokeWidth={3 * u}
          strokeDasharray={`${10 * u} ${14 * u}`}
          strokeDashoffset={-t * 30 * u}
        />
      </svg>
      <Product x={px} y={py} size={size} enterAt={tin + 0.1} from={{ dy: 160, scale: 0.86 }} />
      <Title text={content.choose.title} enterAt={tin + 0.25} exitAt={at("choose-out")} y={portrait ? 0.175 : 0.28} />
      {content.choose.items.map((it, i) => (
        <Criterion
          key={i}
          icon={it.icon}
          label={it.label}
          x={slots[i][0] * width}
          y={slots[i][1] * height}
          enterAt={at(it.cue)}
          checkAt={at("check-all") + i * 0.12}
          size={portrait ? 150 : 124}
        />
      ))}
    </SceneWrap>
  );
};

// ---------- Act 5: brand + CTA ----------
const Kitchen: React.FC<{ p: number; counterY: number }> = ({ p, counterY }) => {
  const { t, at, u, width: W, height: H, portrait } = useScene();
  const tin = at("brand-in");
  const rise = (1 - p) * 0.35 * H;
  const pop = (k: number) => springAt(t - (tin + 0.3 + k * 0.07), SPRINGS.card);
  const win = portrait ? { x: 0.7 * W, y: 0.29 * H, w: 0.23 * W, h: 0.17 * H } : { x: 0.415 * W, y: 0.12 * H, w: 0.11 * W, h: 0.36 * H };
  const shelf = portrait ? { x: 0.06 * W, y: 0.37 * H, w: 0.25 * W } : { x: 0.035 * W, y: 0.34 * H, w: 0.1 * W };
  const herbX = portrait ? 0.13 * W : 0.075 * W;
  const bowlX = portrait ? 0.86 * W : 0.47 * W;
  const ct = counterY;
  const pw = pop(0);
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <defs>
        <linearGradient id="kt-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.bg} />
          <stop offset="1" stopColor={C.bgAlt} />
        </linearGradient>
        <linearGradient id="kt-light" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={I.white} stopOpacity={0.7} />
          <stop offset="1" stopColor={I.white} stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={W} height={ct} fill="url(#kt-wall)" opacity={clamp(p * 2)} />
      {/* window + soft light */}
      <g opacity={clamp(pw * 1.5)} transform={`translate(0 ${30 * u * (1 - pw)})`}>
        <rect x={win.x} y={win.y} width={win.w} height={win.h} rx={14 * u} fill={I.window} stroke={C.surface} strokeWidth={12 * u} />
        <line x1={win.x + win.w / 2} y1={win.y} x2={win.x + win.w / 2} y2={win.y + win.h} stroke={C.surface} strokeWidth={8 * u} />
        <line x1={win.x} y1={win.y + win.h * 0.45} x2={win.x + win.w} y2={win.y + win.h * 0.45} stroke={C.surface} strokeWidth={8 * u} />
        <polygon
          points={`${win.x},${win.y + win.h} ${win.x + win.w},${win.y + win.h} ${win.x + win.w - 0.25 * W},${ct} ${win.x - 0.32 * W},${ct}`}
          fill="url(#kt-light)"
          opacity={0.5}
        />
      </g>
      {/* shelf */}
      <g transform={`translate(0 ${30 * u * (1 - pop(1))})`} opacity={clamp(pop(1) * 1.5)}>
        <rect x={shelf.x} y={shelf.y} width={shelf.w} height={14 * u} rx={4 * u} fill={I.woodDeep} />
        <rect x={shelf.x + shelf.w * 0.1} y={shelf.y - 96 * u} width={58 * u} height={96 * u} rx={14 * u} fill={alpha(I.window, 0.9)} stroke={I.plateRim} strokeWidth={3 * u} />
        <rect x={shelf.x + shelf.w * 0.1} y={shelf.y - 52 * u} width={58 * u} height={52 * u} rx={12 * u} fill={I.oilLight} opacity={0.8} />
        <rect x={shelf.x + shelf.w * 0.1 + 6 * u} y={shelf.y - 110 * u} width={46 * u} height={18 * u} rx={6 * u} fill={I.woodDeep} />
        <path
          d={`M ${shelf.x + shelf.w * 0.55} ${shelf.y} l ${8 * u} ${-62 * u} l ${64 * u} 0 l ${8 * u} ${62 * u} z`}
          fill={I.tomato}
          opacity={0.85}
        />
        {[-40, -10, 20, 50].map((r, k) => (
          <ellipse
            key={k}
            cx={shelf.x + shelf.w * 0.55 + 40 * u + Math.sin((r * Math.PI) / 180) * 50 * u}
            cy={shelf.y - 76 * u - Math.cos((r * Math.PI) / 180) * 20 * u}
            rx={16 * u}
            ry={38 * u}
            transform={`rotate(${r} ${shelf.x + shelf.w * 0.55 + 40 * u + Math.sin((r * Math.PI) / 180) * 50 * u} ${shelf.y - 76 * u - Math.cos((r * Math.PI) / 180) * 20 * u})`}
            fill={I.leaf}
          />
        ))}
      </g>
      {/* counter + cabinets */}
      <g transform={`translate(0 ${rise})`}>
        <rect x={0} y={ct - 0.012 * H} width={W} height={0.035 * H} fill={I.counter} />
        <rect x={0} y={ct + 0.023 * H} width={W} height={H} fill={I.counterEdge} />
        <line x1={0} y1={ct + 0.023 * H} x2={W} y2={ct + 0.023 * H} stroke={alpha(I.shadow, 0.12)} strokeWidth={4 * u} />
        {(portrait ? [0.335, 0.665] : [0.2, 0.4, 0.6, 0.8]).map((f, k) => (
          <line key={k} x1={f * W} y1={ct + 0.035 * H} x2={f * W} y2={H} stroke={alpha(I.shadow, 0.1)} strokeWidth={3 * u} />
        ))}
        {/* herb pot */}
        <g opacity={clamp(pop(2) * 1.5)}>
          <path d={`M ${herbX - 44 * u} ${ct - 80 * u} L ${herbX + 44 * u} ${ct - 80 * u} L ${herbX + 34 * u} ${ct} L ${herbX - 34 * u} ${ct} Z`} fill={C.surface} stroke={I.plateRim} strokeWidth={3 * u} />
          {[-45, -15, 15, 45].map((r, k) => (
            <ellipse
              key={k}
              cx={herbX + Math.sin((r * Math.PI) / 180) * 46 * u}
              cy={ct - 100 * u - Math.cos((r * Math.PI) / 180) * 26 * u}
              rx={17 * u}
              ry={44 * u}
              transform={`rotate(${r + drift(t, 3, 5, k)} ${herbX + Math.sin((r * Math.PI) / 180) * 46 * u} ${ct - 100 * u - Math.cos((r * Math.PI) / 180) * 26 * u})`}
              fill={I.leaf}
            />
          ))}
        </g>
        {/* bowl of fries */}
        <g opacity={clamp(pop(3) * 1.5)} transform={`translate(${bowlX} ${ct}) scale(${u * 0.55})`}>
          <ellipse cx={0} cy={-62} rx={130} ry={34} fill={I.plateRim} />
          {[-50, -20, 10, 35, 60, -5].map((r, k) => (
            <Fry key={k} x={-70 + k * 28} y={-92} len={130} rot={r} />
          ))}
          <path d="M -130 -62 C -120 10, 120 10, 130 -62 Z" fill={C.surface} />
          <path d="M -130 -62 C -120 10, 120 10, 130 -62" fill="none" stroke={I.plateRim} strokeWidth={5} />
          <Steam x={-20} y={-120} t={t} phase={0.2} s={0.9} color={I.plateRim} />
          <Steam x={40} y={-120} t={t} phase={0.65} s={0.9} color={I.plateRim} />
        </g>
      </g>
    </svg>
  );
};

const BrandScene: React.FC = () => {
  const { t, at, u, portrait, width, height, display, body } = useScene();
  const tin = at("brand-in");
  const p = springAt(t - tin, SOFT);
  const ct = (portrait ? 0.6 : 0.7) * height;
  const B = content.images.product.bbox;
  const size = (portrait ? 640 : 720) * u;
  const px = portrait ? 0.5 * width : 0.27 * width;
  const py = ct + 0.008 * height - (B.y1 - 0.5) * size;
  const logo = springAt(t - at("logo-in"), SPRINGS.hero);
  const shine = tween(t, at("logo-in") + 0.55, 0.9, ease.inOutCubic);
  const cta = springAt(t - at("cta-in"), SPRINGS.card);
  const logoW = (portrait ? 700 : 600) * u;
  const logoX = portrait ? 0.5 * width : 0.56 * width + logoW / 2;
  const logoY = portrait ? 0.705 * height : 0.5 * height;
  const nudge = Math.max(0, Math.sin((t - at("cta-in") - 1.2) * Math.PI * 1.2)) * (t > at("cta-in") + 1.2 ? 1 : 0);
  return (
    <SceneWrap from={tin - 0.05} to={at("end") + 1}>
      <Kitchen p={p} counterY={ct} />
      <Product x={px} y={py} size={size} enterAt={tin + 0.35} from={{ dy: -150, scale: 0.92 }} float={false} />
      <Headline
        text={content.brand.slogan}
        enterAt={at("slogan-in")}
        size={portrait ? 78 : 70}
        x={portrait ? 0.5 : 0.56}
        y={portrait ? 0.17 : 0.27}
        maxWidth={portrait ? 0.9 : 0.38}
        align={portrait ? "center" : "left"}
        lineHeight={1.16}
        weight={800}
      />
      {logo > 0 ? (
        <div
          style={{
            position: "absolute",
            left: logoX - logoW / 2,
            top: logoY - logoW / 10,
            width: logoW,
            height: logoW / 5,
            borderRadius: 14 * u,
            overflow: "hidden",
            opacity: clamp(logo * 1.6),
            transform: `translateY(${80 * u * (1 - logo)}px) scale(${mix(0.9, 1, logo)})`,
            boxShadow: `0 ${20 * u}px ${44 * u}px ${alpha(C.accent, 0.3)}`,
          }}
        >
          <Img src={staticFile(content.images.logo.src)} style={{ width: "100%", height: "100%", display: "block" }} />
          {shine > 0 && shine < 1 ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(105deg, transparent ${mix(-30, 100, shine)}%, ${alpha(I.white, 0.35)} ${mix(-15, 115, shine)}%, transparent ${mix(0, 130, shine)}%)`,
              }}
            />
          ) : null}
        </div>
      ) : null}
      {cta > 0 ? (
        <div
          style={{
            position: "absolute",
            left: portrait ? 0.5 * width : 0.56 * width,
            top: portrait ? 0.8 * height : 0.665 * height,
            transform: `translate(${portrait ? "-50%" : "0"}, -50%) translateY(${50 * u * (1 - cta)}px)`,
            opacity: clamp(cta * 1.6),
            display: "flex",
            alignItems: "center",
            gap: 22 * u,
            padding: `${22 * u}px ${24 * u}px ${22 * u}px ${36 * u}px`,
            background: C.surface,
            borderRadius: 30 * u,
            boxShadow: `0 ${16 * u}px ${36 * u}px ${alpha(I.shadow, 0.12)}`,
            whiteSpace: "nowrap",
          }}
        >
          <div style={{ textAlign: portrait ? "center" : "left" }}>
            <div style={{ fontFamily: body, fontWeight: 600, fontSize: 36 * u, lineHeight: 1.3, color: C.text }}>{content.brand.cta}</div>
            <div style={{ fontFamily: display, fontWeight: 800, fontSize: 36 * u, lineHeight: 1.3, color: C.accent }}>{content.brand.ctaPlace}</div>
          </div>
          <div
            style={{
              width: 76 * u,
              height: 76 * u,
              borderRadius: "50%",
              background: C.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "none",
            }}
          >
            <div style={{ transform: `translateX(${nudge * 6 * u}px)` }}>
              <Icon name="ArrowRight" size={38 * u} color={C.onAccent} stroke={2.8} />
            </div>
          </div>
        </div>
      ) : null}
    </SceneWrap>
  );
};

const Scene: React.FC = () => (
  <AbsoluteFill>
    <Background />
    <HookScene />
    <TechScene />
    <BenefitsScene />
    <ChooseScene />
    <BrandScene />
  </AbsoluteFill>
);

const audioPath = `${SLUG}/audio.wav`;

export const Component: React.FC = () => (
  <SceneProvider brand={brand} timeline={timeline}>
    <Scene />
    {getStaticFiles().some((f) => f.name === audioPath) ? <Html5Audio src={staticFile(audioPath)} /> : null}
  </SceneProvider>
);
