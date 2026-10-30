import React from "react";
import { icons } from "lucide-react";
import { alpha } from "../lib/brand";
import { SPRINGS, clamp, enterExit, mix, progress, springAt, tween, ease } from "../lib/motion";
import { useScene } from "../lib/scene";

export type IconName = keyof typeof icons;

const Icon: React.FC<{ name: IconName; size: number; color: string }> = ({ name, size, color }) => {
  const C = icons[name];
  return C ? <C size={size} color={color} strokeWidth={2.2} /> : null;
};

/**
 * Feature callout: a glass pill with an icon, plus an optional leader line that
 * draws from the pill to a hotspot on the product.
 */
export const Callout: React.FC<{
  icon: IconName;
  title: string;
  sub?: string;
  enterAt: number;
  exitAt?: number | null;
  /** Pill centre, canvas fractions. */
  x: number;
  y: number;
  /** Hotspot the leader line points at, canvas fractions. */
  target?: { x: number; y: number } | null;
  /** "left" anchors the pill's left edge at x, so a column of callouts lines up. */
  anchor?: "center" | "left";
  scale?: number;
}> = ({ icon, title, sub, enterAt, exitAt = null, x, y, target = null, anchor = "center", scale = 1 }) => {
  const scene = useScene();
  const { t, width, height, brand, body, display } = scene;
  const u = scene.u * scale;
  const p = enterExit(t, enterAt, exitAt, SPRINGS.card);
  if (t < enterAt || (exitAt !== null && t > exitAt && p < 0.002)) return null;
  const line = tween(t, enterAt + 0.1, 0.5, ease.outCubic) * (exitAt === null ? 1 : 1 - progress(t, exitAt, exitAt + 0.2));
  const c = brand.colors;
  const px = x * width;
  const py = y * height;

  return (
    <>
      {target ? (
        <svg style={{ position: "absolute", inset: 0 }} width={width} height={height}>
          <line
            x1={px}
            y1={py}
            x2={mix(px, target.x * width, line)}
            y2={mix(py, target.y * height, line)}
            stroke={alpha(c.text, 0.45)}
            strokeWidth={2 * u}
            strokeDasharray={`${6 * u} ${6 * u}`}
          />
          <circle cx={target.x * width} cy={target.y * height} r={8 * u * springAt(t - enterAt - 0.5, SPRINGS.bouncy)} fill={c.accent} />
          <circle
            cx={target.x * width}
            cy={target.y * height}
            r={8 * u + 22 * u * tween(t, enterAt + 0.5, 0.8)}
            fill="none"
            stroke={c.accent}
            strokeWidth={2 * u}
            opacity={1 - tween(t, enterAt + 0.5, 0.8)}
          />
        </svg>
      ) : null}
      <div
        style={{
          position: "absolute",
          left: px,
          top: py,
          transform: `translate(${anchor === "left" ? "0" : "-50%"}, -50%) translateY(${mix(40, 0, p) * u}px) scale(${mix(0.9, 1, p)})`,
          transformOrigin: anchor === "left" ? "left center" : "center",
          opacity: clamp(p * 1.5),
          display: "flex",
          alignItems: "center",
          gap: 18 * u,
          padding: `${18 * u}px ${28 * u}px ${18 * u}px ${18 * u}px`,
          borderRadius: brand.radius.pill * u,
          background: alpha(c.surface, 0.72),
          border: `${1.5 * u}px solid ${alpha(c.text, 0.12)}`,
          boxShadow: `0 ${20 * u}px ${50 * u}px ${alpha("#000000", brand.mode === "dark" ? 0.35 : 0.12)}`,
          backdropFilter: `blur(${20 * u}px)`,
          whiteSpace: "nowrap",
        }}
      >
        <div
          style={{
            width: 64 * u,
            height: 64 * u,
            borderRadius: 18 * u,
            background: c.accent,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <Icon name={icon} size={34 * u} color={c.onAccent} />
        </div>
        <div>
          <div style={{ fontFamily: display, fontWeight: 700, fontSize: 34 * u, color: c.text, letterSpacing: `${-0.02 * 34 * u}px` }}>
            {title}
          </div>
          {sub ? (
            <div style={{ fontFamily: body, fontWeight: 500, fontSize: 24 * u, color: c.muted, marginTop: 2 * u }}>{sub}</div>
          ) : null}
        </div>
      </div>
    </>
  );
};

export type CursorKey = { t: number; x: number; y: number; click?: boolean };

/**
 * Pointer that glides between keyframes (canvas fractions) on a no-overshoot spring
 * and dips + ripples on clicks. Keys must be sorted by t.
 */
export const Cursor: React.FC<{ keys: CursorKey[]; enterAt: number; exitAt?: number | null }> = ({
  keys,
  enterAt,
  exitAt = null,
}) => {
  const { t, u, width, height, brand } = useScene();
  const vis = enterExit(t, enterAt, exitAt, SPRINGS.snappy);
  if (vis <= 0.001) return null;

  let x = keys[0].x;
  let y = keys[0].y;
  for (let i = 1; i < keys.length; i++) {
    const k = springAt(t - keys[i - 1].t, { settle: Math.max(0.35, keys[i].t - keys[i - 1].t), overshoot: 0 });
    x = mix(x, keys[i].x, clamp(k));
    y = mix(y, keys[i].y, clamp(k));
  }
  const clicks = keys.filter((k) => k.click).map((k) => k.t);
  const press = clicks.reduce((acc, ct) => {
    const d = t - ct;
    return d >= 0 && d < 0.25 ? Math.max(acc, Math.sin((d / 0.25) * Math.PI)) : acc;
  }, 0);

  return (
    <div style={{ position: "absolute", left: x * width, top: y * height, opacity: vis, pointerEvents: "none" }}>
      {clicks.map((ct, i) => {
        const r = tween(t, ct, 0.6);
        return t >= ct && r < 1 ? (
          <div
            key={i}
            style={{
              position: "absolute",
              left: -40 * u * r,
              top: -40 * u * r,
              width: 80 * u * r,
              height: 80 * u * r,
              borderRadius: "50%",
              border: `${3 * u}px solid ${brand.colors.accent}`,
              opacity: 1 - r,
            }}
          />
        ) : null;
      })}
      <svg
        width={44 * u}
        height={44 * u}
        viewBox="0 0 24 24"
        style={{ transform: `scale(${1 - press * 0.18})`, transformOrigin: "top left", filter: `drop-shadow(0 ${4 * u}px ${8 * u}px rgba(0,0,0,0.35))` }}
      >
        <path d="M4 2 L4 19 L8.5 14.8 L11.6 21.5 L14.4 20.3 L11.4 13.7 L17.5 13.7 Z" fill="#ffffff" stroke="#111111" strokeWidth={1.4} strokeLinejoin="round" />
      </svg>
    </div>
  );
};

/** Primary call-to-action: button + optional URL line. `pressAt` dips the button on a cursor click. */
export const CTA: React.FC<{
  label: string;
  url?: string;
  enterAt: number;
  pressAt?: number | null;
  x: number;
  y: number;
  icon?: IconName;
}> = ({ label, url, enterAt, pressAt = null, x, y, icon = "ArrowRight" }) => {
  const { t, u, width, height, brand, display, body } = useScene();
  const p = springAt(t - enterAt, SPRINGS.card);
  const press = pressAt === null ? 0 : (() => {
    const d = t - pressAt;
    return d >= 0 && d < 0.3 ? Math.sin((d / 0.3) * Math.PI) : 0;
  })();
  const glow = pressAt === null ? 0 : tween(t, pressAt, 0.8);
  const c = brand.colors;

  return (
    <div
      style={{
        position: "absolute",
        left: x * width,
        top: y * height,
        transform: `translate(-50%, -50%) translateY(${mix(60, 0, p) * u}px)`,
        opacity: clamp(p * 1.5),
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 22 * u,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16 * u,
          padding: `${30 * u}px ${54 * u}px`,
          borderRadius: brand.radius.pill * u,
          background: c.accent,
          color: c.onAccent,
          fontFamily: display,
          fontWeight: 700,
          fontSize: 44 * u,
          letterSpacing: `${-0.02 * 44 * u}px`,
          transform: `scale(${mix(0.8, 1, p) - press * 0.06})`,
          boxShadow: `0 ${24 * u}px ${60 * u}px ${alpha(c.accent, 0.35 + glow * 0.25)}, 0 0 0 ${glow * 30 * u}px ${alpha(c.accent, 0.25 * (1 - glow))}`,
          whiteSpace: "nowrap",
        }}
      >
        {label}
        <Icon name={icon} size={44 * u} color={c.onAccent} />
      </div>
      {url ? (
        <div style={{ fontFamily: body, fontWeight: 500, fontSize: 30 * u, color: c.muted, opacity: clamp((t - enterAt - 0.25) * 3) }}>
          {url}
        </div>
      ) : null}
    </div>
  );
};

/** Rotated sticker for price / discount / "New". */
export const Badge: React.FC<{ text: string; sub?: string; enterAt: number; exitAt?: number | null; x: number; y: number; rotate?: number }> = ({
  text,
  sub,
  enterAt,
  exitAt = null,
  x,
  y,
  rotate = -8,
}) => {
  const { t, u, width, height, brand, display, body } = useScene();
  const p = enterExit(t, enterAt, exitAt, SPRINGS.bouncy);
  const c = brand.colors;
  return (
    <div
      style={{
        position: "absolute",
        left: x * width,
        top: y * height,
        transform: `translate(-50%, -50%) rotate(${rotate * p}deg) scale(${p})`,
        padding: `${18 * u}px ${30 * u}px`,
        borderRadius: 24 * u,
        background: c.accent2,
        color: c.bg,
        textAlign: "center",
        boxShadow: `0 ${16 * u}px ${40 * u}px ${alpha("#000000", 0.3)}`,
      }}
    >
      <div style={{ fontFamily: display, fontWeight: 800, fontSize: 52 * u, lineHeight: 1, letterSpacing: `${-0.03 * 52 * u}px` }}>{text}</div>
      {sub ? <div style={{ fontFamily: body, fontWeight: 600, fontSize: 22 * u, marginTop: 6 * u, opacity: 0.8 }}>{sub}</div> : null}
    </div>
  );
};

/** Number that counts up from `from` to `to` between enterAt and enterAt + duration. */
export const Counter: React.FC<{
  from?: number;
  to: number;
  enterAt: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  label?: string;
  x: number;
  y: number;
  size?: number;
}> = ({ from = 0, to, enterAt, duration = 1.2, decimals = 0, prefix = "", suffix = "", label, x, y, size = 120 }) => {
  const { t, u, width, height, brand, display, body } = useScene();
  const p = tween(t, enterAt, duration, ease.outQuint);
  const vis = springAt(t - enterAt, SPRINGS.card);
  const value = mix(from, to, p).toFixed(decimals);
  return (
    <div
      style={{
        position: "absolute",
        left: x * width,
        top: y * height,
        transform: `translate(-50%, -50%) translateY(${mix(30, 0, vis) * u}px)`,
        opacity: clamp(vis * 1.5),
        textAlign: "center",
      }}
    >
      <div style={{ fontFamily: display, fontWeight: 800, fontSize: size * u, color: brand.colors.text, letterSpacing: `${-0.04 * size * u}px`, fontVariantNumeric: "tabular-nums" }}>
        {prefix}
        {value}
        <span style={{ color: brand.colors.accent }}>{suffix}</span>
      </div>
      {label ? <div style={{ fontFamily: body, fontWeight: 500, fontSize: 30 * u, color: brand.colors.muted }}>{label}</div> : null}
    </div>
  );
};

export type MorphState = { t: number; x: number; y: number; w: number; h: number; r: number; fill?: string };

/**
 * One surface that morphs through UI states (pill -> card -> panel -> button).
 * Geometry is in canvas fractions (x, y = centre; w, h = size) and r in u.
 * Children render inside and receive the active state index to swap content.
 */
export const MorphCard: React.FC<{
  states: MorphState[];
  children?: (index: number, blend: number) => React.ReactNode;
}> = ({ states, children }) => {
  const { t, u, width, height, brand } = useScene();
  let s = { ...states[0], fill: states[0].fill ?? brand.colors.surface };
  let index = 0;
  let blend = 1;
  for (let i = 1; i < states.length; i++) {
    const k = springAt(t - states[i].t, SPRINGS.card);
    if (t >= states[i].t) {
      index = i;
      blend = clamp(k);
    }
    s = {
      t: s.t,
      x: mix(s.x, states[i].x, k),
      y: mix(s.y, states[i].y, k),
      w: mix(s.w, states[i].w, k),
      h: mix(s.h, states[i].h, k),
      r: mix(s.r, states[i].r, clamp(k)),
      fill: k > 0.5 ? states[i].fill ?? s.fill : s.fill,
    };
  }
  const w = s.w * width;
  const h = s.h * height;
  return (
    <div
      style={{
        position: "absolute",
        left: s.x * width - w / 2,
        top: s.y * height - h / 2,
        width: w,
        height: h,
        borderRadius: s.r * u,
        background: s.fill,
        overflow: "hidden",
        boxShadow: `0 ${30 * u}px ${70 * u}px ${alpha("#000000", brand.mode === "dark" ? 0.4 : 0.14)}, inset 0 0 0 ${1.5 * u}px ${alpha(brand.colors.text, 0.08)}`,
      }}
    >
      {children ? children(index, blend) : null}
    </div>
  );
};
