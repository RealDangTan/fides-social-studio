import React from "react";
import { Img, staticFile } from "remotion";
import { SPRINGS, clamp, enterExit, mix } from "../lib/motion";
import { useScene } from "../lib/scene";

export const FIDES_TAGLINE = "More Than English, A Brighter Tomorrow.";
export const FIDES_SLOGAN = "Small Steps, Big Futures";

export type FidiPose =
  | "main"
  | "great"
  | "thinking"
  | "idea"
  | "cool"
  | "teach"
  | "study"
  | "surprise"
  | "learners";

// Natural aspect (w/h) of each Fidi pose.
const FIDI_ASPECT: Record<FidiPose, number> = {
  main: 518 / 748,
  great: 1799 / 1858,
  thinking: 1865 / 1320,
  idea: 1523 / 2016,
  cool: 1303 / 1779,
  teach: 1611 / 1850,
  study: 2175 / 1614,
  surprise: 1330 / 1926,
  learners: 1296 / 1858,
};

/**
 * Horizontal Fides logo, white on the purple field. Sits inside the safe area
 * (6% from the edges). Use "color" only on a white scene.
 */
export const FidesLogo: React.FC<{
  enterAt?: number;
  exitAt?: number | null;
  /** Height in u. */
  size?: number;
  x?: number;
  y?: number;
  variant?: "white" | "color";
}> = ({ enterAt = 0, exitAt = null, size = 70, x = 0.5, y, variant = "white" }) => {
  const { t, u, width, height, portrait } = useScene();
  const p = enterExit(t, enterAt, exitAt, SPRINGS.card);
  const h = size * u;
  const w = h * (3717 / 1009);
  const top = (y ?? (portrait ? 0.07 : 0.09)) * height;
  return (
    <Img
      src={staticFile(variant === "white" ? "fides/logos/horizontal-white.png" : "fides/logos/wordmark-color.png")}
      style={{
        position: "absolute",
        left: x * width - w / 2,
        top: top - h / 2,
        width: w,
        height: h,
        opacity: clamp(p),
        transform: `translateY(${mix(-20, 0, p) * u}px)`,
      }}
    />
  );
};

/** The F icon alone (avatars, end cards). */
export const FidesIcon: React.FC<{ enterAt: number; x: number; y: number; size?: number }> = ({
  enterAt,
  x,
  y,
  size = 120,
}) => {
  const { t, u, width, height } = useScene();
  const p = enterExit(t, enterAt, null, SPRINGS.bouncy);
  const h = size * u;
  const w = h * (1076 / 1537);
  return (
    <Img
      src={staticFile("fides/logos/icon-white.png")}
      style={{
        position: "absolute",
        left: x * width - w / 2,
        top: y * height - h / 2,
        width: w,
        height: h,
        opacity: clamp(p),
        transform: `scale(${mix(0.8, 1, p)})`,
      }}
    />
  );
};

/** Fidi the mascot. One per layout; match the pose to the message. */
export const Fidi: React.FC<{
  pose?: FidiPose;
  enterAt: number;
  exitAt?: number | null;
  /** Height in u. */
  size?: number;
  x: number;
  y: number;
  flip?: boolean;
  /** Degrees. */
  rotate?: number;
}> = ({ pose = "main", enterAt, exitAt = null, size = 560, x, y, flip = false, rotate = 0 }) => {
  const { t, u, width, height } = useScene();
  const p = enterExit(t, enterAt, exitAt, SPRINGS.bouncy, SPRINGS.snappy);
  const h = size * u;
  const w = h * FIDI_ASPECT[pose];
  return (
    <Img
      src={staticFile(`fides/mascot/${pose}.png`)}
      style={{
        position: "absolute",
        left: x * width - w / 2,
        top: y * height - h / 2,
        width: w,
        height: h,
        opacity: clamp(p * 3),
        transform: `translateY(${mix(240, 0, p) * u}px) scale(${mix(0.86, 1, p) * (flip ? -1 : 1)}, ${mix(0.86, 1, p)}) rotate(${rotate}deg)`,
      }}
    />
  );
};

/** Brand F/S pattern cropped into one corner of the frame. Never behind body text. */
export const PatternCorner: React.FC<{ corner?: "tl" | "tr" | "bl" | "br"; opacity?: number; size?: number }> = ({
  corner = "br",
  opacity = 0.9,
  size = 620,
}) => {
  const { u } = useScene();
  const s = size * u;
  const pos: React.CSSProperties = {
    ...(corner[0] === "t" ? { top: -s * 0.3 } : { bottom: -s * 0.3 }),
    ...(corner[1] === "l" ? { left: -s * 0.3 } : { right: -s * 0.3 }),
  };
  return (
    <Img
      src={staticFile("fides/pattern/component.png")}
      style={{ position: "absolute", width: s, height: s, opacity, ...pos }}
    />
  );
};
