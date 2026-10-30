# Voice-over (ElevenLabs connector)

The voice-over is a set of short lines. Each line is anchored to a timeline cue, and each gets its own take. Takes come from the **ElevenLabs connector**. They are imported into `public/<slug>/vo/<id>.wav` (silence trimmed, 48 kHz mono), levelled, and mixed into `audio.wav`. Music ducks by 10 dB and SFX by 4 dB while a voice is speaking. One take per line means a retimed cue moves its line with it, and a revision only regenerates the line that changed.

## Files
- `src/videos/<slug>/voiceover.json`: `enabled`, `voice` (voiceId, voiceName, modelId, flowId), `gain`, `duckMusicDb`, `duckSfxDb`, and `lines[{ id, cue, offset, text, generationId }]`. `vo.mjs` fills in `duration` and `take` (`draft` | `final`). Don't edit those two by hand. `text` may include eleven_v4 `[tags]`; the word budget ignores them.
- `projects/<slug>/vo-raw/`: the takes exactly as ElevenLabs returned them.
- `public/<slug>/vo/<id>.wav` holds the final take, and `<id>.draft.wav` the Windows draft. A final take always wins.

## Workflow
1. **Script.** Set `enabled: true` and write one line per act. Usually hook, reveal, features, CTA (3-5 lines for 15 s). Anchor each line to the cue where its picture lands: hook-in (+0.1 offset), name-in, feat-1, cta-in.
2. **Budget.** Run `npm run vo -- <slug>`. It prints each line's start, its window (time until the next line starts, or the end), and a word budget at about 2.4 words/s (measured on eleven_v4). Rewrite any line that goes over budget before spending credits.
3. **Draft (English only).** Run `npm run vo -- <slug> --draft`. The Windows Zira voice makes free takes, and the fit report shows real durations. The draft voice reads more slowly than ElevenLabs, so a draft that fits will fit as a final take. For other languages, skip drafting and stay 20% under budget.
4. **Approve.** Include the lines in the storyboard table the user approves (step 4 of the skill). Pick a voice with `creative_list_voices` (filters below) unless the user named one.
5. **Generate final takes with the connector.** The tools are `mcp__<connector-id>__creative_*`; load them with ToolSearch `select:`. Two ElevenLabs connectors can be present under different ids, and they are **not** the same: use the full one, whose `creative_get_flow_node_types` lists `music` and which has `creative_get_generations`. The other is voice-only and has no `creative_get_generations`, so step 5 below cannot fetch its takes. Use the full one for every call in a video (speech and music share its flow).
   1. `creative_list_voices`: `languages: ["en"]` (or `vi`, ...), `use_cases: ["advertisement"]`, plus a `search` for the mood ("warm friendly upbeat", "calm premium", "energetic"), optionally `gender` / `age` / `descriptives`. Only use a `voice_id` returned by this tool or given by the user.
   2. `creative_create_flow` once per video (name `<slug> voice-over`). Pass its `flow_id` to every speech call.
   3. `creative_generate_speech`, **one call at a time** (parallel calls get HTTP 429). Use `prompt` = the line text, `voice_id`, `model_id: "eleven_v4"` (default; it takes `[tags]`), `generations_count: 1` (the default of 2 doubles the cost), and `flow_id`.
      - There are no voice-settings or speed parameters. Pace with shorter text, punctuation and `[slowly]` / `[pause]` tags.
      - Pass `estimate_only: true` first when the user wants the cost before committing.
   4. Never call generate twice for the same line to "retry". A started generation is charged. Exception: an HTTP 429 response starts nothing, so wait and call again once.
   5. `creative_get_generations` (free) with the `flow_id` and up to 4 `generation_id`s from the `pending` field of each generate result. A `completed` generation has a `full_res_url`: an MP3 on a signed URL that **expires after 2 hours**. If one is still pending, wait a few seconds and ask again.
   6. Import right away: `npm run vo -- <slug> --import <id> '<full_res_url>'`. Single-quote the URL, because it contains `&`. The raw MP3 is kept in `projects/<slug>/vo-raw/`. Each import re-measures every take, re-runs the fit check and rebuilds `audio.wav`.
   7. Record `voice.voiceId`, `voice.voiceName`, `voice.modelId`, `voice.flowId` and each line's `generationId` in voiceover.json, so revisions reuse the same voice and flow.

   Other import sources: a local file path (the user's own recordings) or a `.b64` file holding base64 audio.

   Observed cost on `eleven_v4`: about 25-65 credits per line of 3-12 words.
6. **Fit.** Every line must report `fits`. To fix an overlap, try these in order: shorten the text (regenerate only that line), nudge `offset`, or move the next cue later (and retime its picture). Re-render stills if you moved a cue.
7. **Render + verify.** `verify` fails while any line still uses a draft take, and when the masters are older than the latest take or `audio.wav`. Re-render after every voice change.

## Writing for voice
- On `eleven_v4`, start each line with one delivery tag: `[curious]` for a question hook, `[warmly]` for the reveal, `[excited]` for features and the CTA. Tags are not spoken. Read the connector's `creative_get_model_guide` before using a different model, since the older models speak bracketed text aloud.
- The voice and the screen share the work: the voice says the hook and the CTA nearly verbatim (those must stay memorable), and paraphrases the features instead of reading the callouts word for word.
- Short sentences. Spell numbers the way they should be spoken ("twenty-four hours"). Write URLs for the ear ("tidebottle dot com").
- Never start a line in the first 0.25 s, or after the final 0.3 s.
- Social autoplay starts muted, so the video must still work with the sound off. Never move information off-screen and into the voice only.

## Credits and failures
- ElevenLabs bills per character. Generate final takes only after the user approves the script, and regenerate only lines whose text or voice changed.
- If the connector isn't connected or has no text-to-speech tool, stop and tell the user. They can connect it in claude.ai Connectors (or `/mcp`), or supply their own recorded takes, which import with the same `--import` command. Never deliver the Windows draft voice.
- If a speech call fails twice with the same error (other than a 429 that started nothing), stop and report it (quota, voice permissions, model) instead of retrying.
- Every generation also shows up in the user's ElevenLabs flow (the `url` in the result). Mention that link when delivering, so the user can audition or swap takes there.
