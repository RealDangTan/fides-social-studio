// Voice-over: plan word budgets, make draft takes, import ElevenLabs takes, check fit.
// Usage:
//   npm run vo -- <slug>                       timing report (word budget per line, fit of existing takes)
//   npm run vo -- <slug> --draft               draft takes with the Windows voice (free, for timing only)
//   npm run vo -- <slug> --import <id> <src>   final take for one line; <src> is a file path, an
//                                              http(s) URL, or a .b64/.txt file holding base64 audio
// Every run re-measures takes, writes durations into voiceover.json and rebuilds audio.wav.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FFMPEG, STUDIO, assertSlug, beatToSec, fail, parseArgs, paths, readJson } from "./lib.mjs";
import { durationOf, lineStart, readSpec, voPaths } from "./vo-lib.mjs";

const args = parseArgs(process.argv.slice(2));
const slug = args._[0];
assertSlug(slug);
const p = paths(slug);
const vp = voPaths(slug);
const tl = readJson(p.timeline);
const spec = readSpec(slug);
if (!spec) fail(`no ${path.relative(STUDIO, vp.spec)}; copy it from src/videos/_template/voiceover.json`);
fs.mkdirSync(vp.dir, { recursive: true });

const total = beatToSec(tl, tl.beats);
const GAP = 0.15; // minimum silence between lines
const TAIL = 0.3; // last line must end this long before the video ends

// Trim leading/trailing silence so the take starts exactly on its cue, convert to 48 kHz mono WAV.
const normalise = (src, dst) =>
  execFileSync(FFMPEG, [
    "-v", "error", "-y", "-i", src,
    "-af", "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,afade=t=in:d=0.01",
    "-ac", "1", "-ar", "48000", dst,
  ]);

if (args.import) {
  const id = args.import;
  const src = args._[1];
  if (!spec.lines.some((l) => l.id === id)) fail(`no line "${id}" in voiceover.json`);
  if (!src) fail("pass the take as a file path, URL or base64 file after the line id");
  fs.mkdirSync(vp.raw, { recursive: true });
  let raw;
  if (/^https?:\/\//.test(src)) {
    const res = await fetch(src);
    if (!res.ok) fail(`download failed: ${res.status} ${res.statusText}`);
    const ext = (res.headers.get("content-type") ?? "").includes("wav") ? ".wav" : ".mp3";
    raw = path.join(vp.raw, `${id}${ext}`);
    fs.writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  } else if (/\.(b64|txt)$/i.test(src)) {
    const text = fs.readFileSync(src, "utf8").replace(/^data:[^,]+,/, "").replace(/\s+/g, "");
    raw = path.join(vp.raw, `${id}.mp3`);
    fs.writeFileSync(raw, Buffer.from(text, "base64"));
  } else {
    if (!fs.existsSync(src)) fail(`not found: ${src}`);
    raw = path.join(vp.raw, `${id}${path.extname(src) || ".mp3"}`);
    fs.copyFileSync(src, raw);
  }
  normalise(raw, vp.final(id));
  console.log(`imported ${id}: ${path.relative(STUDIO, vp.final(id))}`);
}

if (args.draft) {
  // Windows SAPI voice, English only. Good enough to judge pacing before paying for real takes.
  const todo = spec.lines.filter((l) => !fs.existsSync(vp.final(l.id)));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vo-draft-"));
  // Strip [audio tags]: the Windows voice would read them aloud
  const jobs = todo.map((l) => ({ text: l.text.replace(/\[[^\]]*\]/g, " ").trim(), out: path.join(tmp, `${l.id}.wav`), id: l.id }));
  fs.writeFileSync(path.join(tmp, "jobs.json"), JSON.stringify(jobs));
  const rate = Math.round(((spec.voice?.speed ?? 1) - 1) * 10);
  const ps = `
    Add-Type -AssemblyName System.Speech
    $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
    try { $s.SelectVoice('${spec.draftVoice ?? "Microsoft Zira Desktop"}') } catch {}
    $s.Rate = ${rate}
    foreach ($j in (Get-Content -Raw -Encoding UTF8 '${path.join(tmp, "jobs.json")}' | ConvertFrom-Json)) {
      $s.SetOutputToWaveFile($j.out); $s.Speak($j.text)
    }
    $s.SetOutputToNull()`;
  execFileSync("powershell", ["-NoProfile", "-Command", ps], { stdio: "inherit" });
  for (const j of jobs) normalise(j.out, vp.draft(j.id));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`draft takes: ${jobs.map((j) => j.id).join(", ") || "none needed (all lines have final takes)"}`);
}

// ---------- Timing report ----------
const lines = spec.lines.map((l) => ({ ...l, start: lineStart(tl, l) })).sort((a, b) => a.start - b.start);
let ok = true;
console.log(`\n${"line".padEnd(10)} ${"start".padStart(6)} ${"window".padStart(7)} ${"budget".padStart(7)} ${"take".padStart(6)}  status`);
lines.forEach((l, i) => {
  const next = lines[i + 1];
  const window = (next ? next.start - GAP : total - TAIL) - l.start;
  // [audio tags] steer delivery on eleven_v4/v3 and are not spoken
  const words = l.text.replace(/\[[^\]]*\]/g, " ").trim().split(/\s+/).length;
  // eleven_v4 measured about 2.4 words/s on short ad lines (full stops slow it further)
  const budget = Math.floor(window * 2.4 * (spec.voice?.speed ?? 1));
  const final = fs.existsSync(vp.final(l.id));
  const file = final ? vp.final(l.id) : fs.existsSync(vp.draft(l.id)) ? vp.draft(l.id) : null;
  const dur = file ? durationOf(file) : null;
  let status;
  if (dur === null) status = words > budget ? `NO TAKE, ${words} words > budget` : `no take (${words} words)`;
  else if (dur > window) status = `OVERLAP by ${(dur - window).toFixed(2)}s`;
  else status = `fits${final ? "" : " (draft)"}`;
  if (status.startsWith("OVERLAP") || status.startsWith("NO TAKE,")) ok = false;
  const src = spec.lines.find((s) => s.id === l.id);
  if (dur !== null) {
    src.duration = +dur.toFixed(3);
    src.take = final ? "final" : "draft";
  } else {
    delete src.duration;
    delete src.take;
  }
  console.log(
    `${l.id.padEnd(10)} ${l.start.toFixed(2).padStart(6)} ${window.toFixed(2).padStart(7)} ${`${budget}w`.padStart(7)} ${dur === null ? "-".padStart(6) : dur.toFixed(2).padStart(6)}  ${status}`,
  );
});
fs.writeFileSync(vp.spec, JSON.stringify(spec, null, 2) + "\n");

if (!ok) {
  console.log("\nFix overlaps: shorten the line and regenerate only that line, adjust its offset, or move the next cue later.");
}
if (spec.enabled && lines.every((l) => fs.existsSync(vp.final(l.id)) || fs.existsSync(vp.draft(l.id)))) {
  execFileSync(process.execPath, [path.join(STUDIO, "scripts", "synth-audio.mjs"), slug], { stdio: "inherit" });
}
process.exit(ok ? 0 : 1);
