// Render checkpoint stills for the critique loop, plus a contact sheet.
// Usage: npm run stills -- <slug> [--pass 1] [--format 16x9|9x16|both] [--at 1.5,4.5,10.5,14] [--cues]
//   --at    explicit times in seconds
//   --cues  one still 0.8 s after every cue (settled state), instead of --at
// Output: projects/<slug>/critique/pass-<n>/<format>-<t>s.png and <format>-contact.png
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { BROWSER, CHROME_MODE, FFMPEG, FORMATS, assertSlug, beatToSec, bundleStudio, parseArgs, paths, pickComposition, readJson } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const slug = args._[0];
assertSlug(slug);
const p = paths(slug);
const tl = readJson(p.timeline);
const total = beatToSec(tl, tl.beats);
const pass = String(args.pass ?? 1);
const formats = !args.format || args.format === "both" ? FORMATS : [args.format];

let times;
if (args.cues) {
  times = [...new Set(Object.values(tl.cues).map((c) => +(beatToSec(tl, c.beat) + 0.8).toFixed(2)))].filter((t) => t < total).sort((a, b) => a - b);
} else {
  times = String(args.at ?? "1.5,4.5,10.5,14").split(",").map(Number);
}
times = times.map((t) => Math.min(t, total - 1 / tl.fps));

const outDir = path.join(p.critique, `pass-${pass}`);
fs.mkdirSync(outDir, { recursive: true });

const { renderStill } = await import("@remotion/renderer");
const serveUrl = await bundleStudio();

for (const fmt of formats) {
  const composition = await pickComposition(serveUrl, `${slug}-${fmt}`);
  const files = [];
  for (const t of times) {
    const frame = Math.round(t * tl.fps);
    const output = path.join(outDir, `${fmt}-${t.toFixed(1)}s.png`);
    await renderStill({ composition, serveUrl, output, frame, browserExecutable: BROWSER, chromeMode: CHROME_MODE, overwrite: true });
    files.push(output);
    console.log(`  ${path.relative(p.project, output)}  (frame ${frame})`);
  }
  // Contact sheet: all checkpoints at reduced size, 2 per row, in time order
  const cols = fmt === "9x16" ? Math.min(files.length, 4) : 2;
  const cellW = fmt === "9x16" ? 360 : 640;
  const cellH = fmt === "9x16" ? 640 : 360;
  const inputs = files.flatMap((f) => ["-i", f]);
  const scaled = files.map((_, i) => `[${i}:v]scale=${cellW}:${cellH}[s${i}]`).join(";");
  const layout = files.map((_, i) => `${(i % cols) * cellW}_${Math.floor(i / cols) * cellH}`).join("|");
  const contact = path.join(outDir, `${fmt}-contact.png`);
  const filter = files.length > 1 ? `${scaled};${files.map((_, i) => `[s${i}]`).join("")}xstack=inputs=${files.length}:layout=${layout}:fill=black` : `[0:v]scale=${cellW}:${cellH}`;
  execFileSync(FFMPEG, ["-v", "error", "-y", ...inputs, "-filter_complex", filter, "-frames:v", "1", contact]);
  console.log(`  ${path.relative(p.project, contact)}  (contact sheet, ${times.join("s, ")}s)`);
}
