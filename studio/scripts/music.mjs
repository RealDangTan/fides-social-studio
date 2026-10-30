// Music track: import a real track (ElevenLabs Music or the client's own), lock it to
// the timeline's beat grid, and mix it in place of the synthesized bed.
// Usage:
//   npm run music -- <slug> --import <src>   <src> is a file path or an http(s) URL
//   npm run music -- <slug>                  re-align the imported track (after editing music.json)
// Options: --downbeat <sec>  force the first downbeat (seconds in the raw file)
//          --no-stretch      keep the track's own tempo
// The track is time-stretched to the timeline BPM (pitch kept), trimmed so a downbeat
// lands on `startBeat`, faded out at the end, written to public/<slug>/music.wav, then
// checked against the grid. It switches timeline.json to music style "track" and rebuilds audio.wav.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { STUDIO, assertSlug, beatToSec, fail, parseArgs, paths, readJson } from "./lib.mjs";
import { bestPhase, decode, detectBeat, detectDownbeat, musicPaths, onsetEnvelope, readMusicSpec, writeWavStereo } from "./music-lib.mjs";

const args = parseArgs(process.argv.slice(2));
const slug = args._[0];
assertSlug(slug);
const p = paths(slug);
const mp = musicPaths(slug);
const tl = readJson(p.timeline);
const spec = readMusicSpec(slug) ?? { provider: "", startBeat: 0, fadeOut: 1 };
const total = beatToSec(tl, tl.beats);
const AN_SR = 22050;
const MAX_GRID_ERROR_MS = 25;

// ---------- Import ----------
if (args.import) {
  const src = String(args.import);
  fs.mkdirSync(mp.raw, { recursive: true });
  let raw;
  if (/^https?:\/\//.test(src)) {
    const res = await fetch(src);
    if (!res.ok) fail(`download failed: ${res.status} ${res.statusText}`);
    const type = res.headers.get("content-type") ?? "";
    raw = path.join(mp.raw, `track${type.includes("wav") ? ".wav" : type.includes("flac") ? ".flac" : ".mp3"}`);
    fs.writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  } else {
    if (!fs.existsSync(src)) fail(`not found: ${src}`);
    raw = path.join(mp.raw, `track${path.extname(src) || ".mp3"}`);
    fs.copyFileSync(src, raw);
  }
  spec.raw = path.relative(STUDIO, raw).replaceAll("\\", "/");
  console.log(`imported: ${spec.raw}`);
}
if (!spec.raw) fail(`no track imported yet. Run: npm run music -- ${slug} --import <file|url>`);
const raw = path.join(STUDIO, spec.raw);
if (!fs.existsSync(raw)) fail(`raw track missing: ${spec.raw}`);

// ---------- Analyse the raw track ----------
const full = onsetEnvelope(decode(raw, AN_SR), AN_SR);
const low = decode(raw, AN_SR, { af: "lowpass=f=150,lowpass=f=150" });
const mid = decode(raw, AN_SR, { af: "highpass=f=1500,lowpass=f=8000" });
const beat = detectBeat(full, tl.bpm);
const db =
  args.downbeat !== undefined ? { downbeat: Number(args.downbeat), confidence: null } : detectDownbeat(low, mid, AN_SR, beat.bpm, beat.phase);
const stretch = args["no-stretch"] ? 1 : tl.bpm / beat.bpm;
if (Math.abs(stretch - 1) > 0.12) {
  fail(`track is ${beat.bpm.toFixed(1)} BPM, too far from ${tl.bpm} to stretch cleanly. Regenerate it with the tempo in the prompt, or pass --no-stretch`);
}
console.log(
  `raw: ${full.duration.toFixed(2)}s  tempo ${beat.bpm.toFixed(2)} BPM (lock ${beat.lock.toFixed(2)})  first downbeat ${db.downbeat.toFixed(3)}s` +
    (db.confidence ? ` (backbeat ${db.confidence.backbeat.toFixed(2)}, beat 1 vs 3 ${db.confidence.bar.toFixed(2)})` : " (forced)"),
);

// ---------- Stretch, align, fade ----------
// After atempo the raw time t lands at t / stretch. Trim so a downbeat sits at
// `startBeat` on the timeline; bars repeat, so any downbeat a whole number of bars
// later is equally valid and the earliest one wastes the least intro.
const bar = (4 * 60) / tl.bpm;
const startSec = beatToSec(tl, spec.startBeat ?? 0);
const downbeat = db.downbeat / stretch;
const trim = ((downbeat % bar) + bar) % bar;
// ffmpeg only stretches and trims; placement, padding and fades happen here, sample-exact.
const SR = 48000;
const filters = [Math.abs(stretch - 1) > 0.0005 ? `atempo=${stretch.toFixed(6)}` : null, `atrim=start=${trim.toFixed(6)}`, "asetpts=PTS-STARTPTS"];
const body = decode(raw, SR, { channels: 2, af: filters.filter(Boolean).join(",") });
const len = Math.round(total * SR);
const s0 = Math.round(startSec * SR);
const covers = Math.min(total, startSec + body.length / 2 / SR);
const fade = Math.min(spec.fadeOut ?? 1, total / 4);
const fadeIn = 0.02 * SR;
const fadeFrom = (covers - fade) * SR;
const pcm = new Float32Array(len * 2);
for (let i = 0; i < len - s0 && i < body.length / 2; i++) {
  const n = s0 + i;
  const out = n < fadeFrom ? 1 : Math.max(0, (covers * SR - n) / (fade * SR));
  const g = Math.min(1, i / fadeIn) * out;
  pcm[2 * n] = body[2 * i] * g;
  pcm[2 * n + 1] = body[2 * i + 1] * g;
}
fs.mkdirSync(p.public, { recursive: true });
writeWavStereo(mp.out, pcm, SR);

// ---------- Check the result against the grid ----------
// Re-measure the written file at the timeline BPM: the best beat phase should sit on
// startSec modulo one beat. This catches a phase that is off by a fraction of a beat
// and atempo drift; a downbeat on the wrong beat of the bar needs ears (--downbeat).
const out = onsetEnvelope(decode(mp.out, AN_SR), AN_SR);
const period = 60 / tl.bpm;
const measured = bestPhase(out, tl.bpm, 0.25 / out.fps).phase;
const expected = ((startSec % period) + period) % period;
let err = measured - expected;
err -= Math.round(err / period) * period;
const after = detectBeat(out, tl.bpm);

spec.analysis = {
  rawBpm: +beat.bpm.toFixed(3),
  stretch: +stretch.toFixed(6),
  downbeatSec: +db.downbeat.toFixed(4),
  downbeatForced: db.confidence === null,
  trimSec: +trim.toFixed(4),
  outBpm: +after.bpm.toFixed(3),
  gridErrorMs: +(err * 1000).toFixed(1),
  lock: +after.lock.toFixed(3),
  coversSec: +Math.min(covers, total).toFixed(3),
};
fs.writeFileSync(mp.spec, JSON.stringify(spec, null, 2) + "\n");
console.log(
  `music.wav: stretch x${stretch.toFixed(4)}, trimmed ${trim.toFixed(3)}s, starts at beat ${spec.startBeat ?? 0}\n` +
    `grid check: ${after.bpm.toFixed(2)} BPM, beat offset ${(err * 1000).toFixed(1)} ms (limit ${MAX_GRID_ERROR_MS}), lock ${after.lock.toFixed(2)}` +
    `, covers ${Math.min(covers, total).toFixed(2)}s of ${total.toFixed(2)}s`,
);

let ok = true;
if (Math.abs(err * 1000) > MAX_GRID_ERROR_MS) {
  ok = false;
  console.log(`OFF GRID: beats land ${(err * 1000).toFixed(0)} ms from the cues. Pass --downbeat <sec> after listening, or regenerate.`);
}
if (covers < total - 0.05) {
  ok = false;
  console.log(`TOO SHORT: the track ends ${(total - covers).toFixed(2)}s before the video. Generate at least ${Math.ceil(total + bar)}s.`);
}

// Switch the timeline to the track (keeping its hand-aligned formatting) and rebuild audio.wav
const tlText = fs.readFileSync(p.timeline, "utf8");
if (tl.music.style !== "track") {
  fs.writeFileSync(p.timeline, tlText.replace(/("music"\s*:\s*\{[^}]*?"style"\s*:\s*)"[^"]*"/, '$1"track"'));
  console.log(`timeline.json: music style ${tl.music.style} -> track`);
}
execFileSync(process.execPath, [path.join(STUDIO, "scripts", "synth-audio.mjs"), slug], { stdio: "inherit" });
process.exit(ok ? 0 : 1);
