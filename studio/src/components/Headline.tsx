import React from "react";
import { SPRINGS, clamp, enterExit, mix, stagger } from "../lib/motion";
import { useScene } from "../lib/scene";

/**
 * Word-by-word masked reveal. Wrap words in *asterisks* to paint them in the accent.
 * Use "\n" for a forced line break.
 */
export const Headline: React.FC<{
  text: string;
  enterAt: number;
  exitAt?: number | null;
  /** Font size in u. */
  size?: number;
  x: number;
  y: number;
  /** Max width as a fraction of canvas width. */
  maxWidth?: number;
  align?: "left" | "center";
  weight?: number;
  color?: string;
  gap?: number;
  font?: "display" | "body";
  /** Line height multiplier. Use about 1.2 for Vietnamese so stacked diacritics clear the line above. */
  lineHeight?: number;
}> = ({
  text,
  enterAt,
  exitAt = null,
  size = 96,
  x,
  y,
  maxWidth = 0.8,
  align = "center",
  weight = 700,
  color,
  gap = 0.055,
  font = "display",
  lineHeight = 1.04,
}) => {
  const { t, u, width, height, brand, display, body } = useScene();
  const lines = text.split("\n").map((l) => l.split(" ").filter(Boolean));
  let i = 0;
  const fs = size * u;

  return (
    <div
      style={{
        position: "absolute",
        left: align === "center" ? x * width - (maxWidth * width) / 2 : x * width,
        top: y * height,
        width: maxWidth * width,
        transform: "translateY(-50%)",
        textAlign: align,
        // Balanced wrapping avoids one-word orphans when a 16:9 line wraps in 9:16
        textWrap: "balance",
        fontFamily: font === "display" ? display : body,
        fontWeight: weight,
        fontSize: fs,
        lineHeight,
        letterSpacing: `${-0.035 * fs}px`,
        color: color ?? brand.colors.text,
      }}
    >
      {lines.map((words, li) => (
        <div key={li} style={{ display: "block" }}>
          {words.map((raw, wi) => {
            const accent = raw.startsWith("*") && raw.replace(/[.,!?]$/, "").endsWith("*");
            const word = raw.replace(/\*/g, "");
            const p = enterExit(t, stagger(enterAt, i++, gap), exitAt, SPRINGS.card);
            return (
              <span
                key={wi}
                style={{
                  display: "inline-block",
                  overflow: "hidden",
                  verticalAlign: "top",
                  // The mask is padded above and below so tall diacritics (Vietnamese ấ, ữ) and
                  // descenders are not clipped while the word slides in.
                  paddingTop: 0.22 * fs,
                  marginTop: -0.22 * fs,
                  paddingBottom: 0.12 * fs,
                  marginBottom: -0.12 * fs,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    transform: `translateY(${mix(105, 0, p)}%)`,
                    opacity: clamp(p * 2),
                    color: accent ? brand.colors.accent : undefined,
                    filter: `blur(${(1 - clamp(p)) * 8 * u}px)`,
                  }}
                >
                  {word}
                  {wi < words.length - 1 ? " " : ""}
                </span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/** Small all-caps kicker / eyebrow line above a headline. */
export const Kicker: React.FC<{
  text: string;
  enterAt: number;
  exitAt?: number | null;
  x: number;
  y: number;
  align?: "left" | "center";
}> = ({ text, enterAt, exitAt = null, x, y, align = "center" }) => {
  const { t, u, width, height, brand, body } = useScene();
  const p = enterExit(t, enterAt, exitAt, SPRINGS.snappy);
  return (
    <div
      style={{
        position: "absolute",
        left: x * width,
        top: y * height,
        transform: `translate(${align === "center" ? "-50%" : "0"}, -50%) translateY(${mix(20, 0, p) * u}px)`,
        opacity: clamp(p),
        fontFamily: body,
        fontWeight: 600,
        fontSize: 26 * u,
        letterSpacing: `${0.18 * 26 * u}px`,
        textTransform: "uppercase",
        color: brand.colors.accent,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
};
