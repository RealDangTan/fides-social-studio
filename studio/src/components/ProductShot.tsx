import React from "react";
import { Img, staticFile } from "remotion";
import { alpha } from "../lib/brand";
import { SPRINGS, drift, enterExit, mix, tween, type SpringPreset } from "../lib/motion";
import { useScene } from "../lib/scene";

export type ProductShotProps = {
  /** Path under public/, e.g. "my-video/product-1.png". */
  src: string;
  /** True for cut-out PNGs (drop-shadow follows the alpha). False frames it as a rounded card. */
  transparent: boolean;
  enterAt: number;
  exitAt?: number | null;
  /** Centre of the product as a fraction of the canvas. */
  x: number;
  y: number;
  /** Rendered height in layout units (u). */
  size: number;
  /** Image aspect ratio, width / height. */
  aspect: number;
  /** Entrance offset in u, and starting rotation in degrees. */
  from?: { dx?: number; dy?: number; rotate?: number; scale?: number };
  float?: boolean;
  /** Seconds at which a light sweep crosses the product. */
  shineAt?: number | null;
  spring?: SpringPreset;
  /** Extra scale multiplier, e.g. driven by a camera push-in. */
  zoom?: number;
};

export const ProductShot: React.FC<ProductShotProps> = ({
  src,
  transparent,
  enterAt,
  exitAt = null,
  x,
  y,
  size,
  aspect,
  from = {},
  float = true,
  shineAt = null,
  spring = SPRINGS.hero,
  zoom = 1,
}) => {
  const { t, width, height, u, brand } = useScene();
  const p = enterExit(t, enterAt, exitAt, spring);
  if (p <= 0.001 && t > enterAt) return null;

  const h = size * u;
  const w = h * aspect;
  const dx = (from.dx ?? 0) * u * (1 - p);
  const dy = ((from.dy ?? 120) * u) * (1 - p) + (float ? drift(t, 10 * u, 4.2) : 0);
  const rot = (from.rotate ?? -6) * (1 - p) + (float ? drift(t, 1.2, 6.5, 1) : 0);
  const scale = mix(from.scale ?? 0.86, 1, p) * zoom;
  const shine = shineAt === null ? -1 : tween(t, shineAt, 0.9);
  const radius = brand.radius.card * u;
  const shadowColor = brand.mode === "dark" ? "#000000" : "#1a1a2e";

  return (
    <div
      style={{
        position: "absolute",
        left: x * width - w / 2 + dx,
        top: y * height - h / 2 + dy,
        width: w,
        height: h,
        opacity: Math.min(1, p * 1.6),
        transform: `rotate(${rot}deg) scale(${scale})`,
        filter: transparent
          ? `drop-shadow(0 ${40 * u}px ${50 * u}px ${alpha(shadowColor, 0.45)})`
          : undefined,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: transparent ? 0 : radius,
          overflow: "hidden",
          boxShadow: transparent
            ? undefined
            : `0 ${40 * u}px ${80 * u}px ${alpha(shadowColor, 0.45)}, 0 0 0 ${1.5 * u}px ${alpha(brand.colors.text, 0.08)}`,
        }}
      >
        <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        {shine > 0 && shine < 1 ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(105deg, transparent ${mix(-30, 100, shine)}%, rgba(255,255,255,0.35) ${mix(-15, 115, shine)}%, transparent ${mix(0, 130, shine)}%)`,
              mixBlendMode: "overlay",
              // Clip the sweep to the product silhouette for cut-outs
              WebkitMaskImage: transparent ? `url(${staticFile(src)})` : undefined,
              WebkitMaskSize: "contain",
              WebkitMaskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
            }}
          />
        ) : null}
      </div>
    </div>
  );
};
