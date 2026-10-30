# Motion rules, tokens, components

## Tokens
Fill `src/videos/<slug>/brand.json` from what you see in the images. `assets.json` gives you the numbers.
- **accent**: the most saturated palette color that reads as *the product's* color: saturation > 0.35, share > 5%. If the product is neutral (black, white, steel), take the accent from the label, logo or packaging. Failing that, use a single tasteful accent that complements the product, and note it in brief.md.
- **bg / bgAlt / surface**: dark mode is the default for colorful or bright products. Use a near-black tinted toward the accent hue (e.g. accent #43d6ae -> bg #06110f, bgAlt #0d2b25, surface #0f201c). Use light mode for dark or black products, and when the photo's backdrop is a uniform light color (`backdrop.uniform: true`). Then set `bg` to the backdrop color so the photo blends in seamlessly.
- **text / muted**: text at least 12:1 against bg, muted at least 4.5:1. Check with `contrast()` from `src/lib/brand.ts` (or by eye in the critique). **onAccent** at least 4.5:1 against accent.
- **accent2**: the sticker/price color. Use a warm complement (yellow, coral) for a dark scene, or a deep tone for a light one.
- **font.display / font.body**: tech/gadgets get InterTight / Inter. Lifestyle and DTC get BricolageGrotesque or Outfit / Inter. Premium/beauty/food gets Fraunces or PlayfairDisplay / Manrope. Playful products get Sora / DMSans. For Vietnamese copy, use only Inter, InterTight, Manrope, SpaceGrotesk, PlusJakartaSans, BricolageGrotesque, Fraunces or PlayfairDisplay (they ship the vietnamese subset).
- **radius.card**: match the product's corner language. Sharp hardware gets 16-24. Soft consumer goods get 32-44.

## Motion grammar
- Every value is a function of `t` (seconds). Get times from `at("cue-id")`.
- **Springs** (`springAt(t - start, SPRINGS.x)`, closed form, deterministic):
  - `snappy` 0.45 s / 1.5%: chips, ticks, cursor
  - `card` 0.7 s / 2%: cards, callouts, words (default)
  - `hero` 1.1 s / 3.5%: the product entrance
  - `bouncy` 0.9 s / 9%: stickers, badges only
  - `glide` 1.2 s / 0%: layout moves and camera
  - Custom: `{ settle, overshoot }`.
- **Eases** (`tween(t, start, dur, ease.outExpo)`) are for opacity, blur, color and line drawing: properties that must never overshoot.
- `enterExit(t, inAt, outAt)` gives 0 -> 1 -> 0 for elements that leave.
- **Stagger** 40-80 ms between siblings (`stagger(start, i, 0.055)`). Never animate a group in unison.
- **One hero motion at a time.** While the product moves, text holds still, and vice versa.
- **Entrances carry mass**: rise 40-260u plus scale from 0.86-0.9, plus slight rotation for objects. Exits are faster than entrances (snappy, no overshoot).
- **Ambient life**: `drift()` for float and background. Amplitude 1% of canvas or less, period over 4 s.
- No linear fades. No dead-centre giant text with drop shadows. No rainbow gradients. No fade-to-black logo ending.
- Never `Math.random()`, `Date.now()`, timers, CSS `transition`/`animation`, or `<Sequence>` for timing.

## Layout
- Positions are canvas fractions, sizes are in `u` (1u = 1px on a 1080 short side). The same code serves 16:9 (1920x1080) and 9:16 (1080x1920). Branch on `portrait` when the composition differs.
- Safe area: keep everything 5% inside every edge. For 9:16 social, keep text out of the bottom 12% and the top 8%, where platform UI sits.
- Product height: 60-70% of the short side during the reveal, 40-55% in feature/close layouts.
- Callouts: left-anchored column in 16:9 (`anchor="left"`, x of about 0.5 when the product sits at 0.3). Centred stack under the product in 9:16. `scale` 1.3-1.35.

## Components (`src/components`)
| Component | Use | Key props |
|---|---|---|
| `Background` | drifting colour field, grain, vignette, optional grid | `energy` 0..1 (bloom), `grid` |
| `ProductShot` | product image with spring entrance, float, light sweep | `src aspect transparent enterAt exitAt x y size from{dx,dy,rotate,scale} shineAt spring zoom` |
| `Headline` | word-by-word masked reveal, balanced wrap, `*accent*` words | `text enterAt exitAt size x y maxWidth align weight color font gap` |
| `Kicker` | small caps eyebrow line | `text enterAt exitAt x y align` |
| `Callout` | icon pill + leader line to a hotspot | `icon title sub enterAt exitAt x y target anchor scale` |
| `Badge` | rotated sticker (price, %, New) | `text sub enterAt exitAt x y rotate` |
| `CTA` | button + URL, press + glow on click | `label url enterAt pressAt x y icon` |
| `Cursor` | glide between keys, click dip + ripple | `keys[{t,x,y,click}] enterAt exitAt` |
| `Counter` | number count-up with label | `from to enterAt duration decimals prefix suffix label x y size` |
| `MorphCard` | one surface morphing through UI states | `states[{t,x,y,w,h,r,fill}]`, children `(index, blend) => node` |

Icons are any lucide name in PascalCase (`Zap`, `ShieldCheck`, `BatteryCharging`, `Leaf`, `Truck`, `Thermometer`, `BellRing`, `Smartphone`, `Sparkles`, `Timer`, `Droplets`, `Recycle`, `Lock`, `Star`).

For anything beyond these (captions, video clips, Lottie, 3D, maps, transitions), read the router at `studio/.agents/skills/remotion-best-practices/SKILL.md`, but keep the f(t) and no-timer rules.
