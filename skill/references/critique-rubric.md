# Critique rubric

Run this on every pass, for both formats. Look at the contact sheet first, then open a full-size still for anything you are unsure about. Judge what is actually in the pixels, not what the code intends.

## Audit prompt (use it on yourself)
> These are checkpoint frames of a product ad at the listed times, 16:9 then 9:16.
> 1. Blockers: any text clipped by an edge or by another element? Any text over a background that makes it hard to read? Any stray or half-rendered element (a ring, a line or an icon visible before its entrance)? Is the product cropped, distorted or pixelated? Is the wrong copy showing?
> 2. Settling: have the elements that should be at rest by this time actually settled, with no headline appearing while cards are still moving?
> 3. Hierarchy: is there exactly one focal point per frame? Is the product the hero during the reveal? Is the CTA the clear end state?
> 4. Layout: are margins at least 5% everywhere? Are columns aligned? Do leader lines cross? Are there awkward empty regions? Are there one-word orphan lines?
> 5. Brand: do the colors come from the product? Is the accent used sparingly? Does the font fit the category?
> 6. Score polish 1-10. If below 8, name the two most glaring defects and give a minimal patch (file + change).

## Scoring
- **9-10**: you'd post it on a product's landing page today.
- **8**: ship-ready. Only nitpicks are left.
- **6-7**: structurally right, with visible layout or contrast flaws.
- **at most 5**: blockers present.

Any blocker caps the score at 5.

## review.md format (one per pass in `critique/pass-N/`)
```
# Pass N  -  16x9: 7/10, 9x16: 6/10
Blockers: none
Defects:
1. 16x9 @10.5s: leader lines cross (feature 1 hotspot at bottom). Fix: reorder features by hotspot y.
2. 9x16 @1.5s: orphan "drink" on its own line. Fix: remove forced \n from hook, rely on balanced wrap.
Patched: content.json (features order, hook)
```

## Frequent defects and their fixes
| Symptom | Likely cause | Fix |
|---|---|---|
| Element visible before its cue | component renders a non-zero state at p = 0 | return `null` when `t < enterAt` |
| Text too small in 16:9 | sizes tuned for 9:16 | raise `size` / `scale` in the landscape branch |
| Empty right third (16:9) | callouts centred on x 0.7 | `anchor="left"` at x of about 0.5 |
| Orphan word | forced `\n` or a narrow maxWidth | drop the `\n`, widen maxWidth (balanced wrap is on) |
| Product looks pasted on | opaque photo on a mismatched bg | use the backdrop color as `bg` (light mode), or frame it as a card |
| Muddy, low contrast | accent too dark, or muted too close to bg | lighten accent / muted, re-check 4.5:1 |
| Everything moves at once | missing stagger, or overlapping cues | stagger 40-80 ms, space cues at least 1.5 beats apart |
| Motion feels dead | eases on position | switch to `springAt` presets |
| CTA lost | product too large at close | shrink the product to 40-50% and recentre |

Stills only show poses. Once you reach a score of 8, render `--draft` once and watch the timing. If the draft shows a problem the stills could not (e.g. a cue landing late), fix it before the final render.
