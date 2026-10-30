// Acceptance gate. A video is done only when every check passes.
// Usage: npm run verify -- <slug> [--format 16x9|9x16|both] [--loop]
//   --format  check only the format that was delivered (default both)
//   --loop    also require the last frame to match the first (seamless loop briefs only)
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { FFMPEG, FFPROBE, FORMATS, assertSlug, beatToSec, parseArgs, paths, readJson } from "./lib.mjs";
import { musicPaths, readMusicSpec } from "./music-lib.mjs";
import { loadVoiceover } from "./vo-lib.mjs";

const args = parseArgs(process.argv.slice(2));
const slug = args._[0];
assertSlug(slug);
const p = paths(slug);
const tl = readJson(p.timeline);
const expected = beatToSec(tl, tl.beats);
const SIZES = { "16x9": [1920, 1080], "9x16": [1080, 1920] };
const vo = loadVoiceover(slug, tl);
const track = tl.music.style === "track";
const mp = musicPaths(slug);
const musicSpec = track ? readMusicSpec(slug) : null;
const audioWav = path.join(p.public, "audio.wav");
// Everything audio.wav is built from that is not code: voice takes and the music track
const inputs = [...(vo ? vo.lines.map((l) => l.file) : []), ...(track && fs.existsSync(mp.out) ? [mp.out] : [])];
const newestInput = Math.max(0, ...inputs.map((f) => fs.statSync(f).mtimeMs));

let ok = true;
const check = (label, pass, detail) => {
  ok &&= pass;
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
};

const formats = !args.format || args.format === "both" ? FORMATS : [args.format];
for (const fmt of formats) {
  const file = path.join(p.published, `${slug}-${fmt}.mp4`);
  console.log(`${slug}-${fmt}.mp4`);
  if (!fs.existsSync(file)) {
    check("file exists", false, file);
    continue;
  }
  const info = JSON.parse(execFileSync(FFPROBE, ["-v", "error", "-show_streams", "-show_format", "-of", "json", file]).toString());
  const v = info.streams.find((s) => s.codec_type === "video");
  const a = info.streams.find((s) => s.codec_type === "audio");
  const dur = Number(info.format.duration);
  const [num, den] = v.r_frame_rate.split("/").map(Number);
  check("duration", Math.abs(dur - expected) <= 2 / tl.fps + 0.03, `${dur.toFixed(3)}s vs ${expected.toFixed(3)}s`);
  check("resolution", v.width === SIZES[fmt][0] && v.height === SIZES[fmt][1], `${v.width}x${v.height}`);
  check("frame rate", Math.abs(num / den - tl.fps) < 0.01, `${(num / den).toFixed(2)} fps`);
  check("pixel format yuv420p", v.pix_fmt === "yuv420p", v.pix_fmt);
  check("audio stream", Boolean(a), a ? `${a.codec_name} ${a.sample_rate} Hz` : "none");
  if (a) {
    const r = spawnSync(FFMPEG, ["-v", "info", "-i", file, "-vn", "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" });
    const mean = Number(/mean_volume:\s*(-?[\d.]+)/.exec(r.stderr)?.[1] ?? -99);
    const max = Number(/max_volume:\s*(-?[\d.]+)/.exec(r.stderr)?.[1] ?? -99);
    check("audio level", mean > -40 && max <= 0, `mean ${mean} dB, peak ${max} dB`);
  }
  if (vo) {
    const drafts = vo.lines.filter((l) => l.draft).map((l) => l.id);
    check("voice-over takes are final", drafts.length === 0, drafts.length ? `draft: ${drafts.join(", ")}` : `${vo.lines.length} lines`);
  }
  if (track) {
    const an = musicSpec?.analysis;
    check("music track imported", fs.existsSync(mp.out) && Boolean(an), musicSpec?.generationId ? `generation ${musicSpec.generationId}` : musicSpec?.raw);
    if (an) {
      check("music locked to the beat grid", Math.abs(an.gridErrorMs) <= 25 && Math.abs(an.outBpm - tl.bpm) < 0.5, `${an.outBpm} BPM, offset ${an.gridErrorMs} ms`);
      check("music covers the video", an.coversSec >= expected - 0.05, `${an.coversSec}s`);
    }
  }
  if (inputs.length) {
    check("audio rebuilt after its inputs", fs.statSync(audioWav).mtimeMs >= newestInput && fs.statSync(file).mtimeMs >= fs.statSync(audioWav).mtimeMs);
  }
  const poster = path.join(p.published, `${slug}-${fmt}-poster.png`);
  check("poster frame", fs.existsSync(poster));
  if (args.loop) {
    const r = spawnSync(
      FFMPEG,
      ["-v", "info", "-i", file, "-sseof", "-0.05", "-i", file, "-filter_complex", "[0:v]trim=end_frame=1[a];[1:v]trim=end_frame=1[b];[a][b]psnr", "-f", "null", "-"],
      { encoding: "utf8" },
    );
    const psnr = /average:([\d.inf]+)/.exec(r.stderr)?.[1] ?? "0";
    check("seamless loop (first vs last frame)", psnr === "inf" || Number(psnr) > 35, `PSNR ${psnr} dB`);
  }
}

console.log(ok ? "\nACCEPTED" : "\nREJECTED");
process.exit(ok ? 0 : 1);
