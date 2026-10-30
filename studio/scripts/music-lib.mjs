// Music track data shared by music.mjs (import, beat alignment) and synth-audio.mjs (mixing).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { FFMPEG, fail, paths, readJson } from "./lib.mjs";

export const musicPaths = (slug) => {
  const p = paths(slug);
  return {
    spec: path.join(p.code, "music.json"),
    raw: path.join(p.project, "music-raw"),
    out: path.join(p.public, "music.wav"),
  };
};

export const readMusicSpec = (slug) => {
  const mp = musicPaths(slug);
  return fs.existsSync(mp.spec) ? readJson(mp.spec) : null;
};

/** Decode any audio file to Float32 PCM (interleaved when channels > 1), optionally through an ffmpeg filter. */
export const decode = (file, sr, { channels = 1, af } = {}) => {
  const buf = execFileSync(
    FFMPEG,
    ["-v", "error", "-i", file, ...(af ? ["-af", af] : []), "-ac", String(channels), "-ar", String(sr), "-f", "f32le", "-"],
    { maxBuffer: 1 << 29 },
  );
  return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
};

// ---------- Beat analysis ----------
// Onset envelope = rise in log energy over a sliding window. A transient shows up
// when it enters the window's leading edge, so frame k is stamped at the end of
// the window, not its centre: that keeps measured beat times absolute, which
// matters because they are compared against cue times.
const HOP = 64;
const WIN = 512;

export const onsetEnvelope = (x, sr) => {
  const n = Math.max(0, Math.floor((x.length - WIN) / HOP));
  const a = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    let e = 0;
    const s = k * HOP;
    for (let i = 0; i < WIN; i++) e += x[s + i] * x[s + i];
    a[k] = Math.log(1e-10 + e);
  }
  const o = new Float32Array(n);
  for (let k = 2; k < n; k++) o[k] = Math.max(0, a[k] - a[k - 2]);
  const fps = sr / HOP;
  return {
    o,
    fps,
    duration: x.length / sr,
    /** Fractional frame index for a time in seconds. */
    frame: (t) => (t * sr - WIN) / HOP + 1,
  };
};

const sampleAt = (env, t) => {
  const f = env.frame(t);
  const i = Math.floor(f);
  if (i < 0 || i + 1 >= env.o.length) return null;
  const w = f - i;
  return env.o[i] * (1 - w) + env.o[i + 1] * w;
};

/** Mean onset strength on a beat comb (period 60/bpm starting at phase, every `every` beats). */
export const combScore = (env, bpm, phase, every = 1) => {
  const step = (60 / bpm) * every;
  let s = 0;
  let c = 0;
  for (let t = phase; t < env.duration; t += step) {
    const v = sampleAt(env, t);
    if (v !== null) {
      s += v;
      c++;
    }
  }
  return c ? s / c : 0;
};

const meanOf = (o) => o.reduce((s, v) => s + v, 0) / Math.max(1, o.length);

/** Best beat phase in [0, period) for a fixed tempo. */
export const bestPhase = (env, bpm, step = 1 / env.fps) => {
  const period = 60 / bpm;
  let best = { phase: 0, score: -1 };
  for (let ph = 0; ph < period; ph += step) {
    const score = combScore(env, bpm, ph);
    if (score > best.score) best = { phase: ph, score };
  }
  return best;
};

/**
 * Tempo and beat phase. A log-normal prior centred on the requested BPM breaks
 * the half/double-time tie that every four-on-the-floor track has.
 */
export const detectBeat = (env, target, { min = 70, max = 180 } = {}) => {
  // Wide enough that a genuine 90 BPM track still wins over a partial fit at 120
  const prior = (bpm) => Math.exp(-0.5 * (Math.log2(bpm / target) / 0.5) ** 2);
  let best = { bpm: target, phase: 0, score: -1 };
  for (let bpm = min; bpm <= max; bpm += 0.25) {
    const { phase, score } = bestPhase(env, bpm, 2 / env.fps);
    const s = score * prior(bpm);
    if (s > best.score) best = { bpm, phase, score: s };
  }
  // Refine tempo and phase around the coarse peak
  let fine = { ...best, score: -1 };
  for (let bpm = best.bpm - 0.4; bpm <= best.bpm + 0.4; bpm += 0.01) {
    for (let ph = best.phase - 12 / env.fps; ph <= best.phase + 12 / env.fps; ph += 0.2 / env.fps) {
      const score = combScore(env, bpm, ph);
      if (score > fine.score) fine = { bpm, phase: ph, score };
    }
  }
  const period = 60 / fine.bpm;
  const phase = ((fine.phase % period) + period) % period;
  return { bpm: fine.bpm, phase, lock: fine.score / Math.max(1e-9, meanOf(env.o)) };
};

/**
 * The downbeat, in two steps, scored on linear band energy just after each beat (log flux
 * would flatten the accents):
 * 1. Backbeat: in 4/4 pop the clap/snare band (`mid`) is loudest on beats 2 and 4, so the
 *    bar starts on the other parity. Four-on-the-floor kicks make the low band useless here.
 * 2. Beat 1 vs beat 3: the one with more low-end weight.
 * Each step reports its winner/runner-up ratio; under ~1.3 that step is a guess.
 */
export const detectDownbeat = (low, mid, sr, bpm, phase) => {
  const period = 60 / bpm;
  const win = Math.floor(0.08 * sr);
  const bandSum = (x, from, step) => {
    let s = 0;
    for (let t = from; t < x.length / sr; t += step) {
      const s0 = Math.floor(t * sr);
      for (let i = Math.max(0, s0); i < Math.min(x.length, s0 + win); i++) s += x[i] * x[i];
    }
    return s;
  };
  const ratio = (a, b) => Math.max(a, b) / Math.max(1e-12, Math.min(a, b));
  // Parity whose beats are NOT the backbeat
  const back = [0, 1].map((j) => bandSum(mid, phase + j * period, 2 * period));
  const onBeat = back[0] <= back[1] ? 0 : 1;
  // Beat 1 or beat 3 of the bar
  const weight = [onBeat, onBeat + 2].map((j) => bandSum(low, phase + j * period, 4 * period));
  const j = weight[0] >= weight[1] ? onBeat : onBeat + 2;
  return { downbeat: phase + j * period, confidence: { backbeat: ratio(back[0], back[1]), bar: ratio(weight[0], weight[1]) } };
};

/** Write interleaved stereo Float32 PCM as a 16-bit WAV. */
export const writeWavStereo = (file, pcm, sr) => {
  const frames = pcm.length / 2;
  const data = Buffer.alloc(frames * 4);
  for (let i = 0; i < pcm.length; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, pcm[i])) * 32767), i * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(2, 22);
  h.writeUInt32LE(sr, 24);
  h.writeUInt32LE(sr * 4, 28);
  h.writeUInt16LE(4, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
};

// ---------- Mixing ----------
/** The aligned track as stereo buses of `len` samples, levelled to about -16 dBFS RMS times music.gain. */
export const loadTrack = (slug, tl, sr, len) => {
  const mp = musicPaths(slug);
  if (!fs.existsSync(mp.out)) fail(`music style is "track" but ${mp.out} is missing. Run: npm run music -- ${slug} --import <file|url>`);
  const pcm = decode(mp.out, sr, { channels: 2 });
  const L = new Float32Array(len);
  const R = new Float32Array(len);
  let sum = 0;
  const n = Math.min(len, pcm.length / 2);
  for (let i = 0; i < n; i++) sum += (pcm[2 * i] ** 2 + pcm[2 * i + 1] ** 2) / 2;
  const norm = (0.16 * tl.music.gain) / Math.max(1e-4, Math.sqrt(sum / Math.max(1, n)));
  for (let i = 0; i < n; i++) {
    L[i] = pcm[2 * i] * norm;
    R[i] = pcm[2 * i + 1] * norm;
  }
  return { L, R };
};
