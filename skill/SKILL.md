---
name: product-motion-video
description: Turn product images into a 15-second marketing/sales motion video (16:9 master + 9:16 vertical cut, synced soundtrack with an optional ElevenLabs Music track and voice-over via the full ElevenLabs connector), built as deterministic Remotion code, rendered with the local Brave, and checked by looking at its own frames. Use when the user gives product photos or screenshots and asks for a product video, promo, ad, launch reel, product demo, social video, motion graphics, "video quảng cáo sản phẩm", or a Remotion video to market or sell something. Every video uses the Fides Scholars brand (see the studio `CLAUDE.md`, section "Fides Scholars branding"). Not for editing existing footage or AI-generated (diffusion) video.
---

# Product motion video

The model writes a program, not pixels. Every frame is `f(t)`; motion uses closed-form springs; sound is synthesized from the same beat-grid timeline as the picture; and nothing ships until checkpoint frames have been inspected and scored. The engineering lives in the studio, so each new video is mostly content + tokens + a critique loop.

**Studio:** `/home/user/fides-social-studio/studio` (Remotion 4, React 19). Its `CLAUDE.md` holds the hard rules (no timers, no `Math.random`, tokens from `brand.json`, Brave only). Read it once at the start of every run. Run all `npm` commands from the studio folder.

## Pre-flight (once per session)
1. `node_modules` exists in the studio, otherwise run `npm install`.
2. Brave exists at `C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe` (or `REMOTION_BROWSER_EXECUTABLE` is set). **Never run `npx remotion browser ensure`. Never download Chrome.**

## Workflow (gated, in order)

### 1. Intake
- Collect the product image paths. Cut-out PNGs look best. Opaque photos still work: they get framed as cards, or blended in when the backdrop is uniform.
- You need these facts: product name, who it's for, 3 benefits (each with proof), an offer (or none), a CTA label + URL, whether to add a voice-over (plus voice preference and language), and the music: the free synthesized bed, an ElevenLabs Music track, or the client's own track. Take what the user gave you and read the rest off the images (packaging text, a screenshot's UI). Ask once, in one message, for whatever is still missing.
- If the user says "just make it" / autopilot, fill the gaps yourself, list each assumption in `brief.md`, and skip the approval wait in step 4.
- Pick a lowercase slug, e.g. `tide-bottle`.

### 2. Scaffold
```bash
npm run new -- <slug> --product "Product Name" "<img1>" "<img2>"
```
This creates `projects/<slug>/` (sources / drafts / critique / published, brief.md, storyboard.xml, assets.json), `public/<slug>/`, and `src/videos/<slug>/` (copied from `_template`). It registers `<slug>-16x9` and `<slug>-9x16` and synthesizes a first `audio.wav`.

### 3. Design tokens from the images (anti-contagion)
Colours and fonts are always the Fides brand already in `brand.json` (do not derive them from images). Look at every image with Read, and read `projects/<slug>/assets.json` (size, aspect, cut-out or opaque, backdrop color, palette). Write `src/videos/<slug>/brand.json` from what you see, never from adjectives. Rules are in [references/motion-rules.md](references/motion-rules.md#tokens). If the user supplied a brand guide, website screenshot or app UI, that overrides the photo palette.

### 4. Brief + storyboard: the approval gate
- Fill `projects/<slug>/brief.md`.
- Write the copy with [references/copy-and-storyboard.md](references/copy-and-storyboard.md): hook (max 7 words), tagline, 3 benefit callouts, offer, CTA.
- Write `projects/<slug>/storyboard.xml`: beats, cues, and element states. The default 4-act map (hook / reveal / features / close) fits most products. Change it only when the brief needs to.
- With a voice-over, write the lines into `voiceover.json` now and run `npm run vo -- <slug>` for word budgets. Run `--draft` for real timings in English.
- With a music track, write the music prompt into `music.json` now (see [references/music.md](references/music.md)) so the user approves it with the rest.
- Show the user a compact beat table (time, what's on screen, copy, voice line, sound) plus the music prompt and **wait for approval** unless they chose autopilot. Then set `approved="true"`.

### 5. Build
- Put the copy in `content.json` and the cue beats in `timeline.json` (cue ids must match the storyboard). Order features by hotspot y so leader lines never cross. Hotspots are 0..1 positions on the hero image.
- Edit `Video.tsx` only where the storyboard departs from the template. Use the components and springs in [references/motion-rules.md](references/motion-rules.md). Follow the hard rules in the studio's `CLAUDE.md`.
- After any timeline change, run `npm run audio -- <slug>`. Audio details: [references/audio.md](references/audio.md).
- **ElevenLabs connector:** two can be connected under different ids. Use only the **full** one: its `creative_get_flow_node_types` lists `music` and it has `creative_get_generations`. The other is voice-only, refuses music nodes and cannot hand back download URLs. If only that one is connected, ask the user to add the full connector (`https://api.elevenlabs.io/v1/mcp`).
- **Music track (optional):** generate one instrumental take with ElevenLabs Music (or take the client's file) and import it with `npm run music -- <slug> --import <file|url>`. The import stretches it to the timeline BPM, puts a downbeat on `startBeat`, and must report a grid offset within 25 ms. Read [references/music.md](references/music.md) before the first connector call.
- **Voice-over (optional):** generate one take per line with the **ElevenLabs connector** and import each with `npm run vo -- <slug> --import <id> <file|url|.b64>`. Every line must report `fits`. Read [references/voiceover.md](references/voiceover.md) before the first connector call. If the connector isn't connected, stop and ask the user to connect it (or to supply recorded takes). Never ship the Windows draft voice.
- Run `npm run typecheck`.
- Optional live preview for the user: start `npx remotion studio --no-open` in the background, then open `http://localhost:3000/<slug>-16x9` in the browser pane.

### 6. Critique loop (multimodal self-inspection)
```bash
npm run stills -- <slug> --pass 1            # 1.5 / 4.5 / 10.5 / 14 s, both formats + contact sheets
npm run stills -- <slug> --pass 2 --cues     # 0.8 s after every cue (settled states)
```
Read `critique/pass-N/16x9-contact.png` and `9x16-contact.png`. Open a full-size still whenever text, edges or contrast need a closer look. Score each frame with [references/critique-rubric.md](references/critique-rubric.md) and write `critique/pass-N/review.md` (score, the two worst defects, the patch). Fix those two defects, then run the next pass.
- **Exit:** both formats score at least 8/10 with no rubric "blocker".
- **Circuit breakers:** if the same build/render error happens twice in a row, stop patching. Re-read the error, then read the matching Remotion skill (`studio/.agents/skills/remotion-best-practices/SKILL.md` routes to it) and change approach. After 3 passes below 8, show the user the best pass with your review and ask how to proceed. Don't keep looping.

### 7. Render + acceptance gate
```bash
npm run render -- <slug> --draft    # optional half-res watch-through in drafts/
npm run render -- <slug>            # published/<slug>-16x9.mp4, -9x16.mp4, posters
npm run verify -- <slug>            # must print ACCEPTED
# Only one format wanted? Pass --format 9x16 (or 16x9) to both render and verify.
```
Rendering takes several minutes, so run it in the background. The run is done only when `verify` prints ACCEPTED: both files exist, duration matches the timeline, 1920x1080 / 1080x1920, 60 fps, yuv420p, audio present and audible, posters exist, (with a voice-over) every take is final, (with a music track) the track is imported, locked to the grid and covers the whole video, and the masters were rendered after the latest audio input. Add `--loop` only for briefs that ask for a seamless loop.

### 8. Deliver
Report the published paths, both posters (show one), the final critique score, and any assumptions you made. For client work, offer the next revision round (cap: 2). [references/delivery.md](references/delivery.md) covers scope, variants (6 s / 30 s cuts), and pitching.

## Context discipline
Load a reference only when you reach the step that needs it. Don't read `node_modules`, and don't dump other videos' code into context. To improve every future video, change `src/videos/_template/` or `src/components/`, then say so to the user.
