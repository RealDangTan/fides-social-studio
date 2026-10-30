// Voice-over data shared by vo.mjs (timing, import) and synth-audio.mjs (mixing).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { FFMPEG, FFPROBE, beatToSec, fail, paths, readJson } from "./lib.mjs";

export const voPaths = (slug) => {
  const p = paths(slug);
  return {
    spec: path.join(p.code, "voiceover.json"),
    dir: path.join(p.public, "vo"),
    raw: path.join(p.project, "vo-raw"),
    final: (id) => path.join(p.public, "vo", `${id}.wav`),
    draft: (id) => path.join(p.public, "vo", `${id}.draft.wav`),
  };
};

export const readSpec = (slug) => {
  const vp = voPaths(slug);
  return fs.existsSync(vp.spec) ? readJson(vp.spec) : null;
};

/** Seconds at which a line starts: its cue plus offset. */
export const lineStart = (tl, line) => {
  const cue = tl.cues[line.cue];
  if (!cue) fail(`voice line "${line.id}": unknown cue "${line.cue}"`);
  return beatToSec(tl, cue.beat) + (line.offset ?? 0);
};

export const durationOf = (file) =>
  Number(execFileSync(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim());

export const decodeMono = (file, sr) => {
  const buf = execFileSync(FFMPEG, ["-v", "error", "-i", file, "-ac", "1", "-ar", String(sr), "-f", "f32le", "-"], { maxBuffer: 1 << 28 });
  return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
};

/**
 * Lines ready to mix, or null when the voice-over is off. A final (ElevenLabs)
 * take wins over a draft take. Missing audio is an error once enabled.
 */
export const loadVoiceover = (slug, tl) => {
  const spec = readSpec(slug);
  if (!spec || !spec.enabled || !spec.lines?.length) return null;
  const vp = voPaths(slug);
  const lines = spec.lines.map((line) => {
    const final = vp.final(line.id);
    const draft = vp.draft(line.id);
    const file = fs.existsSync(final) ? final : fs.existsSync(draft) ? draft : null;
    if (!file) fail(`voice line "${line.id}" has no audio. Run: npm run vo -- ${slug} --draft, or import the ElevenLabs take`);
    return { ...line, file, draft: file === draft, start: lineStart(tl, line) };
  });
  return {
    lines,
    gain: spec.gain ?? 1,
    duckMusicDb: spec.duckMusicDb ?? -10,
    duckSfxDb: spec.duckSfxDb ?? -4,
  };
};
