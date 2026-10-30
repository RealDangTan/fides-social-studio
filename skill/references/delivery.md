# Delivery, scope, variants

## Deliverables (default package)
- `published/<slug>-16x9.mp4`: 1920x1080, 60 fps, H.264 CRF 16, AAC 320k. Landing pages, YouTube, Product Hunt.
- `published/<slug>-9x16.mp4`: 1080x1920. Reels, TikTok, Shorts, story ads.
- `published/<slug>-<fmt>-poster.png`: the settled CTA frame, for thumbnails and `<video poster>`.
- Source on request: `src/videos/<slug>/`, `public/<slug>/`, plus the shared `src/lib` and `src/components`.

Extra sizes: add an entry to `FORMATS` in `src/Root.tsx` (e.g. `"1x1": { width: 1080, height: 1080 }` or `"4x5": { width: 1080, height: 1350 }`), add the matching size to `SIZES` in `scripts/verify.mjs`, and add the format to `FORMATS` in `scripts/lib.mjs`. Then check the layout branches, since 1:1 counts as `portrait === false`.

For web embeds where file size matters, re-encode a copy into `drafts/`. Never overwrite the master:
```bash
ffmpeg -i published/<slug>-16x9.mp4 -c:v libx264 -crf 24 -preset slow -an -movflags +faststart drafts/<slug>-16x9-web.mp4
```

## Scope (for client work)
- Exactly one core message, a fixed length (15 s unless agreed otherwise), the 16:9 and 9:16 deliverables above, and 2 revision rounds.
- A revision is a list of changes against the delivered cut. Apply the list, run the critique loop again (at least 1 pass), render, and verify.
- Anything outside the brief counts as a new brief: a new act, a new length, a new product.

## Pitching (when the user sells this as a service)
- Sell the outcome, not "AI video": "a 15-second product reel for your hero section and paid social, in your brand colors, delivered in 16:9 and 9:16."
- Build a concept demo first. Take one product in the niche, make the reel, and label it "Concept demo".
- Licensing: Remotion is free for individuals and companies of up to 3 people. Larger companies need a Remotion company license (remotion.dev/license). The synthesized audio and the Google Fonts used here are free to use commercially. Product images and logos remain the client's property.
