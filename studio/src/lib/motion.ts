// Deterministic motion primitives. Every function here is a pure function of time:
// no state, no timers, no previous-frame velocity. Frame N renders identically
// whether you play from 0 or seek straight to it.

export type SpringPreset = {
  /** Seconds until the spring stays within 2% of its target. */
  settle: number;
  /** Peak overshoot past the target, 0 = critically damped, 0.02 = 2%. */
  overshoot: number;
};

/** Interface presets in the Apple / Linear / Stripe register. */
export const SPRINGS = {
  /** Buttons, chips, cursor clicks. */
  snappy: { settle: 0.45, overshoot: 0.015 },
  /** Cards and panels entering. The default. */
  card: { settle: 0.7, overshoot: 0.02 },
  /** Hero product entrances, large surfaces with mass. */
  hero: { settle: 1.1, overshoot: 0.035 },
  /** Playful pops: badges, price stickers, emoji. */
  bouncy: { settle: 0.9, overshoot: 0.09 },
  /** Camera moves and layout morphs. No overshoot. */
  glide: { settle: 1.2, overshoot: 0 },
} as const satisfies Record<string, SpringPreset>;

export type SpringName = keyof typeof SPRINGS;

const zetaFromOvershoot = (overshoot: number) => {
  if (overshoot <= 0) return 1;
  const l = Math.log(overshoot);
  return -l / Math.sqrt(Math.PI * Math.PI + l * l);
};

/**
 * Closed-form step response of a damped harmonic oscillator, 0 -> 1.
 * x(t) = 1 - e^(-zeta*w*t) * (cos(wd*t) + (zeta*w/wd) * sin(wd*t))
 * `t` is seconds since the spring started; negative t returns 0.
 */
export const springAt = (t: number, preset: SpringPreset = SPRINGS.card): number => {
  if (t <= 0) return 0;
  const zeta = Math.min(zetaFromOvershoot(preset.overshoot), 1);
  // 2% settling-time approximation: Ts ~= 4 / (zeta * w)
  const w = 4 / (Math.max(zeta, 0.3) * preset.settle);
  if (zeta >= 1) {
    // Critically damped
    return 1 - Math.exp(-w * t) * (1 + w * t);
  }
  const wd = w * Math.sqrt(1 - zeta * zeta);
  const decay = Math.exp(-zeta * w * t);
  return 1 - decay * (Math.cos(wd * t) + ((zeta * w) / wd) * Math.sin(wd * t));
};

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const mix = (a: number, b: number, p: number) => a + (b - a) * p;

/** Map v from [inA, inB] to [0, 1], clamped. */
export const progress = (v: number, inA: number, inB: number) =>
  clamp((v - inA) / (inB - inA));

// Easings for things that should not overshoot (opacity, blur, color).
export const ease = {
  outExpo: (p: number) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)),
  outCubic: (p: number) => 1 - Math.pow(1 - p, 3),
  inOutCubic: (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  inCubic: (p: number) => p * p * p,
  outQuint: (p: number) => 1 - Math.pow(1 - p, 5),
};

/** Eased tween between two times (seconds). */
export const tween = (
  t: number,
  start: number,
  duration: number,
  fn: (p: number) => number = ease.outExpo,
) => fn(progress(t, start, start + duration));

/**
 * Spring that enters at `inAt` and (optionally) exits at `outAt`.
 * Returns 0 before entry, ~1 while held, back to 0 after exit.
 */
export const enterExit = (
  t: number,
  inAt: number,
  outAt: number | null = null,
  inSpring: SpringPreset = SPRINGS.card,
  outSpring: SpringPreset = SPRINGS.snappy,
) => {
  const enter = springAt(t - inAt, inSpring);
  if (outAt === null) return enter;
  return enter * (1 - clamp(springAt(t - outAt, { ...outSpring, overshoot: 0 })));
};

/** Start time for item `i` in a staggered group. */
export const stagger = (start: number, i: number, gap = 0.06) => start + i * gap;

/** Slow deterministic drift, e.g. floating products or background blobs. */
export const drift = (t: number, amplitude: number, period: number, phase = 0) =>
  Math.sin((t / period) * Math.PI * 2 + phase) * amplitude;

/** Deterministic pseudo-random in [0, 1) from an integer seed. Never use Math.random. */
export const hash = (seed: number) => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};
