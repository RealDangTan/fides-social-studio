// Render the masters. Bundles once, renders each format, writes a poster frame.
// Usage: npm run render -- <slug> [--format 16x9|9x16|both] [--draft]
//   --draft  half resolution into projects/<slug>/drafts/ for a quick watch-through
// Output: projects/<slug>/published/<slug>-<format>.mp4 and <slug>-<format>-poster.png
import fs from "node:fs";
import path from "node:path";
import { BROWSER, CHROME_MODE, FORMATS, assertSlug, beatToSec, bundleStudio, parseArgs, paths, pickComposition, readJson } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const slug = args._[0];
assertSlug(slug);
const p = paths(slug);
const tl = readJson(p.timeline);
const formats = !args.format || args.format === "both" ? FORMATS : [args.format];
const draft = Boolean(args.draft);
const outDir = draft ? p.drafts : p.published;
fs.mkdirSync(outDir, { recursive: true });

const { renderMedia, renderStill } = await import("@remotion/renderer");
const serveUrl = await bundleStudio();

// Poster = the CTA beat once it has settled, or 85% through if there is no cta cue.
const ctaCue = tl.cues["cta-click"] ?? tl.cues["cta-in"];
const posterFrame = Math.round((ctaCue ? beatToSec(tl, ctaCue.beat) + 0.6 : beatToSec(tl, tl.beats) * 0.85) * tl.fps);

for (const fmt of formats) {
  const composition = await pickComposition(serveUrl, `${slug}-${fmt}`);
  const output = path.join(outDir, `${slug}-${fmt}${draft ? "-draft" : ""}.mp4`);
  const started = Date.now();
  let last = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: output,
    browserExecutable: BROWSER,
    chromeMode: CHROME_MODE,
    imageFormat: draft ? "jpeg" : "png",
    jpegQuality: 90,
    pixelFormat: "yuv420p",
    crf: draft ? 23 : 16,
    audioCodec: "aac",
    audioBitrate: "320k",
    scale: draft ? 0.5 : 1,
    overwrite: true,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 10) * 10;
      if (pct !== last) {
        last = pct;
        process.stdout.write(`\r  ${fmt}: ${pct}%`);
      }
    },
  });
  console.log(`\r  ${fmt}: ${path.relative(p.project, output)}  (${((Date.now() - started) / 1000).toFixed(0)}s)`);
  if (!draft) {
    const poster = path.join(outDir, `${slug}-${fmt}-poster.png`);
    await renderStill({ composition, serveUrl, output: poster, frame: Math.min(posterFrame, composition.durationInFrames - 1), browserExecutable: BROWSER, chromeMode: CHROME_MODE, overwrite: true });
    console.log(`  ${fmt}: ${path.relative(p.project, poster)}`);
  }
}
