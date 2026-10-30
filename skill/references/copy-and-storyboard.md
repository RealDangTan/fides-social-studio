# Copy and storyboard

## Copy rules for a 15 s product reel
- **One idea per beat.** A viewer reads about 3 words per second. Nothing on screen should take more than 2 seconds to read.
- **Hook (0-3 s), max 7 words.** Pick one:
  - Problem: "You forgot to drink water again."
  - Promise: "Coffee that stays hot for 12 hours."
  - Contrast: "Not another to-do app."
  - Number: "3 seconds to a perfect brew."
  - Callout: "Runners, this one's for you."

  Mark one or two words with `*asterisks*` to paint them in the accent. Never mark the whole line.
- **Tagline:** one sentence about what changes for the buyer, not what the product is made of.
- **Callouts:** title = benefit (max 4 words), sub = proof (max 5 words): "Cold for 24 hours / double-wall steel". Lead with the benefit that is most visible in the photo.
- **Offer:** use one only if it is real. Keep it short: "-25%", "New", "$49", "Free shipping". Put the context in `sub`.
- **CTA:** verb first, 1-3 words: "Get yours", "Shop now", "Try it free". Add the URL without `https://`.
- Write in the buyer's language. If the user writes Vietnamese, the copy can be Vietnamese. Pick fonts that ship the vietnamese subset (list in motion-rules.md#tokens). Sora, Outfit and DM Sans do not.
- Never invent claims (certifications, numbers, awards) that the user or the packaging does not state. If a benefit needs a number you don't have, phrase it without one.

## Default beat map (120 BPM, 30 beats = 15 s)
| Act | Beats | Seconds | Cues | Picture | Sound |
|---|---|---|---|---|---|
| Hook | 0-6 | 0-3 | hook-in, hook-out | kicker + hook headline, product hidden | whoosh, reverse swoosh into the drop |
| Reveal | 6-13 | 3-6.5 | hero-in, name-in, hero-shine | hero springs in, background blooms, name + tagline | drop (riser + sub boom), drums start |
| Features | 13-23 | 6.5-11.5 | feat-move, feat-1..3 | product glides aside, callouts land every 2 beats with leader lines | whoosh, pop on each callout |
| Close | 23-30 | 11.5-15 | close-move, offer-in, cta-in, cursor-in, cta-click | product recentres, extra images fan in, offer sticker, CTA, cursor click | pop, tick, click on the downbeat |

Timing rules:
- Big moves land on a bar downbeat (beat divisible by 4) or on beat 2 of a bar. Callouts land on even beats.
- Leave at least 1.5 beats between something entering and the next thing entering in the same region.
- The last 3 beats hold still on the CTA. Viewers need time to read it.

## Variants
- **6 s bumper** (12 beats): hook-in 0.5 -> hero-in 2 -> cta-in 7 -> cta-click 9. Drop the features act.
- **30 s** (60 beats): two features acts (3 callouts each), or a features act plus a "how it works" act using `MorphCard` or `Counter`.
- **Multiple products / colourways:** add the images to `content.images`. The template fans images 2-3 in at close. For a colourway carousel, add a `ProductShot` per image with staggered `enterAt` / `exitAt` on consecutive beats.
- **App / SaaS screenshots:** treat the screenshot as an opaque card (`transparent: false`). Use `MorphCard` for UI-state transitions (pill -> modal -> chart -> button) and `Cursor` keyframes for interactions. See `studio/.agents/skills/remotion-saas`.

Change `timeline.beats` (and the cues) to change the length. Composition duration follows automatically.

## storyboard.xml
The template in `projects/<slug>/storyboard.xml` is the spec. Keep it structural:
- `<beat id from to goal>` for each act.
- `<cue id beat sfx>`, mirrored 1:1 in `timeline.json`.
- `<state el at pos size enter move text icon hotspot>`: one per element per change. Positions are canvas fractions, sizes are in `u` (1u = 1px at a 1080 short side).

Present it to the user as a table, not as raw XML.
