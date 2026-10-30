# Motion studio

Remotion studio for product-marketing videos. The `product-motion-video` skill drives the workflow; this file holds the standards that apply to every video.

## Hard rules
- Every frame is a pure function of time. Components read `t` from `useScene()` and cue times from `at("cue-id")`. No `setTimeout`, `setInterval`, `requestAnimationFrame`, `Date.now()`, `Math.random()` or CSS transitions/animations. Use `hash(seed)` from `src/lib/motion.ts` for randomness.
- Do not wrap timing in `<Sequence>`; use absolute cue times so the soundtrack stays locked to the picture.
- Motion comes from `src/lib/motion.ts`: `springAt` presets (`snappy`, `card`, `hero`, `bouncy`, `glide`) for position/scale, `tween` + `ease` for opacity/blur/colour. No linear fades on everything.
- Timing lives in `src/videos/<slug>/timeline.json` on the 120 BPM grid (2 beats per second, 30 frames per beat at 60 fps). Change a beat there, then run `npm run audio -- <slug>`.
- Colours, fonts and radii live in `brand.json`, taken from the product images and supplied brand material. No hard-coded hex values in components.
- Layout in canvas fractions and `u` units so one component tree serves 16:9 and 9:16. Check both.
- Text contrast at least 4.5:1 against what sits behind it. Nothing within 5% of any canvas edge.
- Rendering uses the installed Brave (`remotion.config.ts`, `scripts/lib.mjs`). Never run `npx remotion browser ensure` or download Chrome Headless Shell.

## Directories
- `projects/<slug>/sources/` client images as received. Never edit.
- `projects/<slug>/drafts/` scratch renders and experiments.
- `projects/<slug>/critique/pass-N/` checkpoint stills and `review.md` for each critique pass.
- `projects/<slug>/published/` final masters and posters only.
- `public/<slug>/` what the composition loads. `src/videos/<slug>/` the code.
- `src/videos/_template/` the starter. Change it only to improve every future video.

## Commands
- `npm run new -- <slug> --product "Name" <img...>` scaffold
- `npm run audio -- <slug>` regenerate soundtrack from timeline.json (+ voice-over if enabled)
- `npm run vo -- <slug> [--draft | --import <id> <file|url|.b64>]` voice-over budgets, draft takes, ElevenLabs takes, fit check
- `npm run music -- <slug> [--import <file|url>] [--downbeat <sec>] [--no-stretch]` import a music track (ElevenLabs Music or the client's), stretch it to the BPM, lock its downbeat to the grid
- `npm run stills -- <slug> --pass N [--cues | --at 1.5,4.5,10.5,14]` checkpoint stills + contact sheet
- `npm run render -- <slug> [--draft]` masters (or half-res draft)
- `npm run verify -- <slug> [--format 16x9|9x16]` acceptance gate
- `npm run typecheck`
- `npm run studio` live preview at http://localhost:3000

## Remotion reference
Remotion's own agent skills are in `.agents/skills/` (router: `remotion-best-practices/SKILL.md`). Load the matching one only when the task needs it.
