# Music track (ElevenLabs Music or the client's own)

By default the soundtrack's music is a synthesized bed (audio.md). A real track replaces only the music bus: SFX stay on their cues, the voice-over still ducks the music, and `timeline.json` stays the single clock. The import makes the track obey that clock. It measures the track's tempo, time-stretches it to the timeline BPM (pitch kept), trims it so a downbeat lands on `startBeat`, fades the tail, and re-measures the result against the grid.

## Files
- `src/videos/<slug>/music.json`: `provider`, `modelId`, `flowId`, `nodeId`, `generationId`, `prompt`, `startBeat` (timeline beat where the track's first downbeat lands, default 0), `fadeOut` (seconds). `music.mjs` writes `raw` and `analysis` (raw BPM, stretch, downbeat, trim, measured BPM, `gridErrorMs`, `coversSec`). Don't edit those by hand.
- `projects/<slug>/music-raw/track.*`: the track exactly as received.
- `public/<slug>/music.wav`: stretched, aligned, faded, video length. `timeline.json` gets `music.style: "track"`.

## Workflow
1. **Decide** at intake: synthesized bed (free, nothing to license), ElevenLabs Music (credits; commercial use depends on the user's ElevenLabs plan, so say so), or the client's track (they must hold the rights).
2. **Prompt** (ElevenLabs only). Describe the sound, never the picture, in 1-3 sentences: genre, mood, key instruments, production, **the exact BPM** (the timeline's), and how the energy moves on the video's beat map. For the default 4-act map: "soft filtered intro for the first 3 seconds, the full beat hits at 3 seconds, steady through the middle, ends on a clean final hit." No vocals: they fight the voice-over and the on-screen copy. Put the prompt in `music.json` and in the storyboard table the user approves.
   - The model holds the BPM well (tide-demo asked for 120 and got 119.96) but treats the structure as a suggestion. The same take ignored "soft intro, the full beat hits at 3 seconds" and played full-energy from the first beat. Don't count on the track for the reveal moment: keep the `drop` SFX on the hero cue so the impact comes from the cue, and check the per-beat energy if the structure matters.
3. **Generate with the full connector** (see SKILL.md for telling the two apart). A music node needs parameters that the one-call `creative_generate_in_flow` cannot set, so use the node path:
   1. Reuse the video's flow (`voiceover.json` `voice.flowId`) or `creative_create_flow` once (`<slug> audio`).
   2. `creative_add_flow_node`: `node_type: "music"`, `model_id: "eleven_music_v2_5"`, `prompt`, `model_parameters: { duration_seconds: <video length + 2>, instrumental: true, lyrics_type: "instrumental" }`, `label: "music"`. The extra 2 s (one bar at 120 BPM) leaves room for the downbeat trim.
   3. `creative_run_flow_nodes` with `estimate_only: true` first and tell the user the credit cost. Then run it for real with `generations_count: 1`: **the default is 4 variations**, and 4 costs 4 times as much.
   4. Poll `creative_get_generations` (or `creative_get_flow_run_status` with the returned `session_ids`, which also carries the `error_message`) every 1-3 minutes, using a background `sleep` between checks. Music is far slower than its estimate: on 2026-10-27, a 17 s take estimated at 71 s was still generating after 12 minutes and then failed with "unexpected error generating music". Never call run again to "retry" a take that is still generating: every run is charged.
      - On a `failed` status with that server error, one retry is allowed. A run sent right after a failure can get HTTP 429; that starts nothing, so wait a minute and send it once more.
      - If a take is still generating after about 15 minutes, stop polling, tell the user the node URL and generation id, and offer to resume later (`creative_get_generations` with that id still works) or ship the synthesized bed.
   5. `creative_get_generations` with the generation id gives a `full_res_url` (signed, **expires after 2 hours**).
   6. Import right away: `npm run music -- <slug> --import '<full_res_url>'` (single quotes: the URL contains `&`).
   7. Record `flowId`, `nodeId` and `generationId` in `music.json`.

   Client track: `npm run music -- <slug> --import <path>`.
4. **Read the report.** It prints the raw tempo with a lock score, the first downbeat with two confidences, the stretch, and the grid check. The downbeat is found in two steps, each with a winner/runner-up ratio where under about 1.3 is a guess. `backbeat` finds which beats carry the clap/snare (beats 2 and 4), so the bar starts on the other ones. `beat 1 vs 3` uses low-end weight and is often a guess on flat four-on-the-floor tracks; that is harmless unless the picture's big moments must hit bar 1 of a phrase.
   - `beat offset` must be within 25 ms (verify fails otherwise).
   - A raw tempo more than 12% from the timeline BPM is refused, because the stretch would sound wrong. Regenerate with the BPM in the prompt, or pass `--no-stretch` for a track that should not follow the grid.
   - `TOO SHORT` means the track ends before the video. Regenerate it longer.
5. **Listen for the downbeat.** The grid check proves beats land on beats, not that bar 1 starts on beat 1 of the bar. If the drop or the CTA click lands on the "and" of the phrase, find the true first downbeat in the raw file and re-run with `--downbeat <seconds>`. If the track's own big hit comes later than the picture's, set `startBeat` in `music.json` and re-run `npm run music -- <slug>` (no re-import).
6. **Mix.** `gain` in `timeline.json` levels the track (0.4-0.6 under a voice-over). Keep the `drop` SFX only if it adds to the track's own hit; set it to `thud` or `none` when the track already has a big downbeat there. Then run `npm run audio -- <slug>`, render, and verify. `verify` checks that the track is imported, locked to the grid and long enough, and that audio and masters are newer than it.

## Failures
- Music generation failing twice with the same error: stop and report it (quota, plan, region). Don't fall back silently: ask whether to ship the synthesized bed.
- Mention the ElevenLabs flow link on delivery so the user can audition or swap the track there.
