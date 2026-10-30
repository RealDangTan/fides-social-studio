import React from "react";
import { AbsoluteFill } from "remotion";
import { alpha } from "../lib/brand";
import { drift } from "../lib/motion";
import { useScene } from "../lib/scene";

/**
 * Soft drifting colour field + grain + vignette. Deliberately low-contrast so the
 * product carries the frame. `energy` (0..1) can be driven by a cue to bloom the
 * accent during the reveal.
 */
export const Background: React.FC<{ energy?: number; grid?: boolean }> = ({
  energy = 0,
  grid = false,
}) => {
  const { brand, t, width, height, frame, u } = useScene();
  const { bg, bgAlt, accent, accent2 } = brand.colors;
  const dark = brand.mode === "dark";

  const blob = (cx: number, cy: number, r: number, color: string, a: number) =>
    `radial-gradient(${r}px ${r}px at ${cx}px ${cy}px, ${alpha(color, a)}, transparent 70%)`;

  const R = Math.max(width, height);
  const layers = [
    blob(width * 0.2 + drift(t, 60 * u, 9), height * 0.25 + drift(t, 40 * u, 11, 1), R * 0.55, bgAlt, 0.9),
    blob(width * 0.85 + drift(t, 50 * u, 13, 2), height * 0.8 + drift(t, 60 * u, 10), R * 0.5, accent, 0.18 + energy * 0.22),
    blob(width * 0.55 + drift(t, 80 * u, 15, 3), height * 0.5, R * 0.35, accent2, 0.08 + energy * 0.1),
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: bg }}>
      <AbsoluteFill style={{ background: layers.join(", ") }} />
      {grid ? (
        <AbsoluteFill
          style={{
            backgroundImage: `linear-gradient(${alpha(brand.colors.text, 0.05)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(brand.colors.text, 0.05)} 1px, transparent 1px)`,
            backgroundSize: `${80 * u}px ${80 * u}px`,
            backgroundPosition: `${-t * 6 * u}px ${-t * 4 * u}px`,
            maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          }}
        />
      ) : null}
      {/* Grain: seed steps every 2 frames so it shimmers without strobing */}
      <AbsoluteFill style={{ opacity: dark ? 0.07 : 0.05, mixBlendMode: dark ? "screen" : "multiply" }}>
        <svg width={width} height={height}>
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={Math.floor(frame / 2) % 16} />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, transparent 55%, ${alpha(dark ? "#000000" : bg, dark ? 0.55 : 0.35)} 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
