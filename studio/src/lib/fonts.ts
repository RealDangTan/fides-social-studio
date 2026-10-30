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
import type { FontKey } from "./brand";

type Loader = {
  loadFont: (style?: "normal", opts?: object) => { fontFamily: string };
  getInfo: () => { fonts: { normal?: Record<string, unknown> }; subsets: string[] };
};

const LOADERS: Record<FontKey, Loader> = {
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
} as unknown as Record<FontKey, Loader>;

const WANT_WEIGHTS = ["400", "500", "600", "700", "800"];
// Vietnamese where the family has it (not Sora, Outfit, DM Sans).
const WANT_SUBSETS = ["latin", "latin-ext", "vietnamese"];

const loaded = new Map<FontKey, string>();

/** Loads a Google font once and returns its CSS family. */
export const fontFamily = (key: FontKey): string => {
  const hit = loaded.get(key);
  if (hit) return hit;
  const loader = LOADERS[key];
  const info = loader.getInfo();
  const { fontFamily: family } = loader.loadFont("normal", {
    weights: WANT_WEIGHTS.filter((w) => w in (info.fonts.normal ?? {})),
    subsets: WANT_SUBSETS.filter((s) => info.subsets.includes(s)),
    ignoreTooManyRequestsWarning: true,
  });
  loaded.set(key, family);
  return family;
};
