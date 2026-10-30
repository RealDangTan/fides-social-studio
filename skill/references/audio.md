# Audio

`npm run audio -- <slug>` builds `public/<slug>/audio.wav` (48 kHz stereo) from `src/videos/<slug>/timeline.json`. The composition picks the file up automatically. There are no samples, so there is nothing to license.

## timeline.json
```json
{
  "fps": 60, "bpm": 120, "beats": 30,
  "music": { "style": "pulse", "key": "A", "gain": 0.55 },
  "cues": { "hero-in": { "beat": 6, "sfx": "drop", "gain": 1, "note": "..." } }
}
```
- 120 BPM puts a beat every 0.5 s, which is 30 frames at 60 fps. Fractional beats are fine (`24.5` = an eighth note after beat 24).
- Picture and sound read the same cue. To retime anything, edit the beat here, then re-run `npm run audio`. Never hand-place sound in an editor.

## Music styles
- `pulse` (default): four-on-the-floor kick, clap on beats 2 and 4, offbeat hats, an eighth-note bass, and an i-VI-III-VII pad. The bass and pad duck under the kick.
- `minimal`: half-time kick, no clap. Good for premium, calm, or beauty products.
- `house`: pulse plus open hats and sixteenths. Good for energetic DTC and sports products.
- `none`: SFX only. Use it when the client will add their own track after delivery.
- `track`: a real music track (ElevenLabs Music or the client's file) from `public/<slug>/music.wav`, levelled by `gain`. `npm run music -- <slug> --import ...` sets this and does the beat alignment. See [music.md](music.md). `key` is ignored, and the bed's sidechain pumping is off: the track brings its own drums.

Drums enter on the first `drop` cue, so the hook plays over pad and hats only. The last beat is a tail with a short fade. `key` is any note name (A, F#, Bb...). Pick one that suits the mood: A or F minor feels neutral, while C or G minor reads darker.

## SFX vocabulary
| sfx | sound | use on |
|---|---|---|
| `whoosh` | swept noise panned L->R, peaks about 0.1 s after the cue | headline entrances, layout moves |
| `swoosh-rev` | reverse swoosh that peaks exactly on the cue | clearing the stage before a reveal |
| `riser` | 1.6 s build that ends on the cue | before a reveal that has no drop |
| `drop` | riser + sub boom + noise burst | the hero reveal (only once) |
| `pop` | 900->300 Hz bubble | callouts, stickers |
| `tick` | short 3.2 kHz tick | small text, secondary elements |
| `click` | 1.8 kHz decaying sine + transient | cursor clicks, button presses |
| `chime` | inharmonic bell | success states, checkmarks |
| `shimmer` | 5-note sparkle run | light sweep over the product |
| `thud` | low knock | product landing, heavy objects |
| `none` | silence | cues that exist only for timing |

Use at most one SFX per half-beat, and keep `gain` between 0.6 and 1.2. If everything is loud, nothing is.

With a voice-over enabled, the synth mixes it on its own bus and ducks the music and SFX beneath it. See [voiceover.md](voiceover.md). Leave a little room around voice lines: avoid stacking `drop` or `whoosh` cues in the middle of a sentence.

To add a new sound, add a function to the `SFX` map in `studio/scripts/synth-audio.mjs` and the name to the `Sfx` type in `src/lib/timeline.ts`.
