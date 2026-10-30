import * as Inter from "@remotion/google-fonts/Inter";
import * as InterTight from "@remotion/google-fonts/InterTight";
import * as Manrope from "@remotion/google-fonts/Manrope";
import * as SpaceGrotesk from "@remotion/google-fonts/SpaceGrotesk";
import * as DMSans from "@remotion/google-fonts/DMSans";
import * as Sora from "@remotion/google-fonts/Sora";
import * as PlusJakartaSans from "@remotion/google-fonts/PlusJakartaSans";
import * as Outfit from "@remotion/google-fonts/Outfit";
import * as PlayfairDisplay from "@remotion/google-fonts/PlayfairDisplay";
import * as Fraunces from "@remotion/google-fonts/Fraunces";
import * as BricolageGrotesque from "@remotion/google-fonts/BricolageGrotesque";
import { continueRender, delayRender, staticFile } from "remotion";
import type { FontKey } from "./brand";

// Brand fonts shipped in public/fides/fonts (offline, Vietnamese-complete).
const LOCAL: Partial<Record<FontKey, { family: string; faces: { file: string; weight: string; style?: string }[] }>> = {
  BeVietnamPro: {
    family: "Be Vietnam Pro",
    faces: [
      { file: "BeVietnamPro-Regular.ttf", weight: "400" },
      { file: "BeVietnamPro-Medium.ttf", weight: "500" },
      { file: "BeVietnamPro-SemiBold.ttf", weight: "600" },
      { file: "BeVietnamPro-Bold.ttf", weight: "700" },
      { file: "BeVietnamPro-ExtraBold.ttf", weight: "800" },
    ],
  },
  KoHo: {
    family: "KoHo",
    faces: [{ file: "KoHo-SemiBoldItalic.ttf", weight: "600", style: "italic" }],
  },
};

const loadLocal = (key: FontKey): string => {
  const def = LOCAL[key]!;
  for (const f of def.faces) {
    const handle = delayRender(`font ${def.family} ${f.weight}`);
    const face = new FontFace(def.family, `url(${staticFile(`fides/fonts/${f.file}`)})`, {
      weight: f.weight,
      style: f.style ?? "normal",
    });
    face
      .load()
      .then(() => {
        (document.fonts as unknown as { add(f: FontFace): void }).add(face);
        continueRender(handle);
      })
      .catch((err) => {
        console.error(err);
        continueRender(handle);
      });
  }
  return `"${def.family}", system-ui, sans-serif`;
};

type Loader = {
  loadFont: (style?: "normal", opts?: object) => { fontFamily: string };
  getInfo: () => { fonts: { normal?: Record<string, unknown> }; subsets: string[] };
};

const LOADERS: Partial<Record<FontKey, Loader>> = {
  Inter,
  InterTight,
  Manrope,
  SpaceGrotesk,
  DMSans,
  Sora,
  PlusJakartaSans,
  Outfit,
  PlayfairDisplay,
  Fraunces,
  BricolageGrotesque,
} as unknown as Partial<Record<FontKey, Loader>>;

const WANT_WEIGHTS = ["400", "500", "600", "700", "800"];
// Vietnamese where the family has it (not Sora, Outfit, DM Sans).
const WANT_SUBSETS = ["latin", "latin-ext", "vietnamese"];

const loaded = new Map<FontKey, string>();

/** Loads a Google font once and returns its CSS family. */
export const fontFamily = (key: FontKey): string => {
  const hit = loaded.get(key);
  if (hit) return hit;
  if (LOCAL[key]) {
    const family = loadLocal(key);
    loaded.set(key, family);
    return family;
  }
  const loader = LOADERS[key]!;
  const info = loader.getInfo();
  const { fontFamily: family } = loader.loadFont("normal", {
    weights: WANT_WEIGHTS.filter((w) => w in (info.fonts.normal ?? {})),
    subsets: WANT_SUBSETS.filter((s) => info.subsets.includes(s)),
    ignoreTooManyRequestsWarning: true,
  });
  loaded.set(key, family);
  return family;
};
