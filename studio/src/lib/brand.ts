// Design tokens for one video. Extracted from the product images (and any app
// screenshot or brand guide the client sent), never invented from adjectives.

export type Brand = {
  name: string;
  colors: {
    /** Page background. */
    bg: string;
    /** Secondary background for gradient blobs. */
    bgAlt: string;
    /** Card / surface color. */
    surface: string;
    /** Primary text on bg. */
    text: string;
    /** Secondary text on bg. */
    muted: string;
    /** Brand accent, pulled from the product itself. */
    accent: string;
    /** Text color on accent fills. Must pass 4.5:1 against accent. */
    onAccent: string;
    /** Optional second accent for highlights / price tags. */
    accent2: string;
  };
  font: {
    display: FontKey;
    body: FontKey;
  };
  radius: {
    card: number;
    pill: number;
  };
  /** "dark" or "light" scene, drives shadows and grain. */
  mode: "dark" | "light";
};

export type FontKey =
  | "BeVietnamPro"
  | "KoHo"
  | "Inter"
  | "InterTight"
  | "Manrope"
  | "SpaceGrotesk"
  | "DMSans"
  | "Sora"
  | "PlusJakartaSans"
  | "Outfit"
  | "PlayfairDisplay"
  | "Fraunces"
  | "BricolageGrotesque";

/** Relative luminance per WCAG 2.x. */
export const luminance = (hex: string) => {
  const n = hex.replace("#", "");
  const full = n.length === 3 ? n.split("").map((c) => c + c).join("") : n;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** #rrggbb + alpha -> rgba() */
export const alpha = (hex: string, a: number) => {
  const n = hex.replace("#", "");
  const full = n.length === 3 ? n.split("").map((c) => c + c).join("") : n;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};
