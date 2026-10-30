// Turn a product photo shot on a uniform white backdrop into a cut-out PNG.
// The backdrop is flood-filled from the image border (so light highlights inside
// the product are never touched), then "un-composited" from white: a pixel that
// was 30% grey shadow on white becomes black at 30% alpha. Soft shadows survive
// as real shadows and the product pixels stay exactly as photographed.
// Usage: node scripts/cutout.mjs <in.png|jpg> <out.png> [--threshold 200]
import { execFileSync } from "node:child_process";
import { FFMPEG, FFPROBE, fail, parseArgs } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const [input, output] = args._;
if (!input || !output) fail("usage: node scripts/cutout.mjs <in> <out.png> [--threshold 200]");
const threshold = Number(args.threshold ?? 200);

const probe = JSON.parse(
  execFileSync(FFPROBE, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", input]).toString(),
);
const { width: W, height: H } = probe.streams[0];
const px = execFileSync(FFMPEG, ["-v", "error", "-i", input, "-f", "rawvideo", "-pix_fmt", "rgba", "-"], { maxBuffer: 1 << 28 });

const minc = (i) => Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
// Flood fill the backdrop from every border pixel that is light enough.
const bgMask = new Uint8Array(W * H);
const stack = [];
for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
while (stack.length) {
  const i = stack.pop();
  if (bgMask[i] || minc(i) < threshold) continue;
  bgMask[i] = 1;
  const x = i % W;
  const y = (i / W) | 0;
  if (x > 0) stack.push(i - 1);
  if (x < W - 1) stack.push(i + 1);
  if (y > 0) stack.push(i - W);
  if (y < H - 1) stack.push(i + W);
}
// Grow the mask by one pixel so the anti-aliased rim is un-composited too.
const edge = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) {
  if (bgMask[i]) continue;
  const x = i % W;
  if ((x > 0 && bgMask[i - 1]) || (x < W - 1 && bgMask[i + 1]) || bgMask[i - W] || bgMask[i + W]) edge[i] = 1;
}

const out = Buffer.from(px);
let cleared = 0;
for (let i = 0; i < W * H; i++) {
  if (!bgMask[i] && !edge[i]) continue;
  const [r, g, b] = [px[i * 4], px[i * 4 + 1], px[i * 4 + 2]];
  // Alpha from the darkest channel: pure white -> 0, anything darker keeps its share.
  const a = 1 - Math.min(r, g, b) / 255;
  if (a < 0.02) {
    out[i * 4 + 3] = 0;
    cleared++;
    continue;
  }
  // Un-composite from white: c = (c_obs - (1 - a) * 255) / a
  for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.max(0, Math.min(255, Math.round((px[i * 4 + c] - (1 - a) * 255) / a)));
  out[i * 4 + 3] = Math.round(a * 255);
}

execFileSync(FFMPEG, ["-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-i", "-", "-frames:v", "1", output], { input: out });
console.log(`cutout: ${output}  ${W}x${H}  backdrop ${((cleared / (W * H)) * 100).toFixed(1)}% cleared, threshold ${threshold}`);
