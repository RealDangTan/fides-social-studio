// Synthesize the soundtrack from the video's timeline.json: a beat-grid music bed
// (or the imported track when music style is "track") plus one SFX per cue. The
// synthesized bed and SFX use no samples, so there is nothing to license, and
// moving a cue in timeline.json moves its sound with the picture.
// Usage: npm run audio -- <slug>      -> public/<slug>/audio.wav
import fs from "node:fs";
import path from "node:path";
import { assertSlug, beatToSec, fail, paths, readJson } from "./lib.mjs";
import { loadTrack } from "./music-lib.mjs";
import { decodeMono, loadVoiceover } from "./vo-lib.mjs";

const slug = process.argv[2];
assertSlug(slug);
const p = paths(slug);
if (!fs.existsSync(p.timeline)) fail(`no timeline at ${p.timeline}`);
const tl = readJson(p.timeline);

const SR = 48000;
const total = beatToSec(tl, tl.beats);
const len = Math.ceil(total * SR);
const beatSec = 60 / tl.bpm;

// Three buses so the voice-over can duck music and SFX independently.
const bus = () => ({ L: new Float32Array(len), R: new Float32Array(len) });
const music = bus();
const sfx = bus();
const voice = bus();
// add() writes into whichever bus is current: music while building the bed, sfx for cues.
let target = music;

// Deterministic noise
let seed = 0x9e3779b9;
const noise = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 2147483648 - 1;
};

/** Add a mono voice fn(localTime) starting at `start` seconds for `dur` seconds, with pan -1..1. */
const add = (start, dur, gain, fn, pan = 0) => {
  const s0 = Math.max(0, Math.floor(start * SR));
  const s1 = Math.min(len, Math.floor((start + dur) * SR));
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = s0; i < s1; i++) {
    const v = fn(i / SR - start, i);
    target.L[i] += v * gl;
    target.R[i] += v * gr;
  }
};

const NOTES = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
const rootMidi = 45 + (((NOTES[tl.music.key] ?? 9) - 9 + 12) % 12) - (((NOTES[tl.music.key] ?? 9) - 9 + 12) % 12 > 6 ? 12 : 0);
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
const TAU = Math.PI * 2;

// ---------- SFX ----------
const lowpass = (cut) => {
  let y = 0;
  return (x, c = cut) => {
    const a = 1 - Math.exp((-TAU * c) / SR);
    y += a * (x - y);
    return y;
  };
};

const SFX = {
  // Tactile UI click: decaying 1800 Hz sine + 2 ms transient
  click: (at, g) => {
    add(at, 0.08, 0.5 * g, (t) => Math.sin(TAU * 1800 * t) * Math.exp(-t * 90) + (t < 0.002 ? noise() * 0.6 : 0));
    add(at, 0.06, 0.25 * g, (t) => Math.sin(TAU * 600 * t) * Math.exp(-t * 70));
  },
  tick: (at, g) => add(at, 0.04, 0.22 * g, (t) => Math.sin(TAU * 3200 * t) * Math.exp(-t * 200)),
  // Bubble pop: pitch sweep 900 -> 300 Hz
  pop: (at, g) => {
    let ph = 0;
    add(at, 0.18, 0.45 * g, (t) => {
      ph += (TAU * (300 + 600 * Math.exp(-t * 40))) / SR;
      return Math.sin(ph) * Math.exp(-t * 28);
    });
  },
  // Air whoosh: band-limited noise, bell envelope, swept cutoff, panned L -> R
  whoosh: (at, g) => {
    const lp = lowpass(800);
    const dur = 0.55;
    const s = at - 0.18;
    for (const side of [-1, 1]) {
      const lpS = side < 0 ? lp : lowpass(800);
      add(s, dur, 0.32 * g, (t) => {
        const e = Math.sin(Math.PI * Math.min(1, t / dur)) ** 2;
        return lpS(noise(), 400 + 5000 * (t / dur)) * e;
      }, side * 0.6);
    }
  },
  // Reverse swoosh that peaks exactly on the cue
  "swoosh-rev": (at, g) => {
    const lp = lowpass(600);
    const dur = 0.4;
    add(at - dur, dur + 0.03, 0.35 * g, (t) => lp(noise(), 300 + 6000 * (t / dur) ** 2) * (t / dur) ** 2.5);
  },
  // Riser that ends on the cue
  riser: (at, g) => {
    const dur = 1.6;
    const lp = lowpass(500);
    let ph = 0;
    add(at - dur, dur, 0.22 * g, (t) => {
      const k = t / dur;
      ph += (TAU * (180 + 900 * k * k)) / SR;
      return (lp(noise(), 300 + 7000 * k * k) * 0.8 + Math.sin(ph) * 0.3) * k * k;
    });
  },
  // Downbeat impact: short riser, sub boom with pitch drop, filtered noise burst
  drop: (at, g) => {
    SFX.riser(at, 0.8 * g);
    let ph = 0;
    add(at, 1.4, 0.75 * g, (t) => {
      ph += (TAU * (45 + 70 * Math.exp(-t * 12))) / SR;
      return Math.tanh(Math.sin(ph) * 1.6) * Math.exp(-t * 2.6);
    });
    const lp = lowpass(1200);
    add(at, 0.5, 0.35 * g, (t) => lp(noise(), 3000 * Math.exp(-t * 6) + 200) * Math.exp(-t * 7));
  },
  // Bell chime: inharmonic partials
  chime: (at, g) => {
    const f = 1318.5;
    add(at, 1.4, 0.18 * g, (t) =>
      (Math.sin(TAU * f * t) + 0.5 * Math.sin(TAU * f * 2.76 * t) * Math.exp(-t * 3) + 0.25 * Math.sin(TAU * f * 5.4 * t) * Math.exp(-t * 6)) *
      Math.exp(-t * 2.2),
    );
  },
  // Sparkle run for product shine
  shimmer: (at, g) => {
    [0, 4, 7, 12, 16].forEach((n, i) => {
      const f = hz(rootMidi + 36 + n);
      add(at + i * 0.045, 0.7, 0.07 * g, (t) => Math.sin(TAU * f * t) * Math.exp(-t * 5) * Math.min(1, t * 400), i % 2 ? 0.4 : -0.4);
    });
  },
  thud: (at, g) => {
    let ph = 0;
    add(at, 0.3, 0.6 * g, (t) => {
      ph += (TAU * (60 + 60 * Math.exp(-t * 30))) / SR;
      return Math.sin(ph) * Math.exp(-t * 14);
    });
  },
  // Frying-oil sizzle: hissing high-passed noise plus random crackle pops, 1.8 s,
  // cut short at the end so a freeze-frame cue right after it lands in silence.
  sizzle: (at, g) => {
    const dur = 1.8;
    const lp = lowpass(3500);
    const lp2 = lowpass(9000);
    let pop = 0;
    add(at, dur, 0.3 * g, (t) => {
      const n = noise();
      const hiss = (lp2(n) - lp(n)) * (0.55 + 0.45 * Math.sin(t * 23) * Math.sin(t * 7.3));
      if (noise() > 0.9993) pop = 1;
      pop *= 0.992;
      const crackle = pop * noise() * 2.2;
      const env = Math.min(1, t / 0.08) * Math.min(1, (dur - t) / 0.06);
      return (hiss + crackle) * env;
    }, -0.1);
  },
  none: () => {},
};

// ---------- Music bed ----------
const kick = (at, g) => {
  let ph = 0;
  add(at, 0.45, 0.8 * g, (t) => {
    ph += (TAU * (48 + 110 * Math.exp(-t * 28))) / SR;
    return Math.tanh(Math.sin(ph) * 2) * Math.exp(-t * 7) + (t < 0.003 ? noise() * 0.3 : 0);
  });
};
const clap = (at, g) => {
  const lp = lowpass(2500);
  add(at, 0.25, 0.32 * g, (t) => {
    const bursts = t < 0.03 ? 0.6 + 0.4 * Math.sin(t * 900) : 1;
    return (noise() - lp(noise())) * Math.exp(-t * 18) * bursts;
  });
};
const hat = (at, g, open = false) => {
  const lp = lowpass(7000);
  add(at, open ? 0.25 : 0.06, 0.12 * g, (t) => (noise() - lp(noise())) * Math.exp(-t * (open ? 14 : 60)), 0.25);
};

// 4-bar loop i - VI - III - VII in the root key
const PROG = [
  [0, 3, 7],
  [-4, 0, 3],
  [3, 7, 10],
  [-2, 2, 5],
];

const sidechain = new Float32Array(len).fill(1);
const duckAt = (at) => {
  const s0 = Math.floor(at * SR);
  for (let i = s0; i < Math.min(len, s0 + SR * 0.4); i++) sidechain[i] = Math.min(sidechain[i], 1 - 0.65 * Math.exp(-((i - s0) / SR) * 9));
};

const style = tl.music.style;
if (style === "track") {
  // Already stretched and aligned to the grid by music.mjs
  const track = loadTrack(slug, tl, SR, len);
  music.L.set(track.L);
  music.R.set(track.R);
} else if (style !== "none") {
  const mg = tl.music.gain;
  const dropCue = Object.values(tl.cues).find((c) => c.sfx === "drop");
  const drumsFrom = dropCue ? dropCue.beat : 0;
  const lastBeat = tl.beats - 1;
  const pad = new Float32Array(len);
  const bass = new Float32Array(len);

  for (let b = 0; b < tl.beats; b++) {
    const at = b * beatSec;
    const bar = Math.floor(b / 4);
    const chord = PROG[bar % 4];
    const inDrums = b >= drumsFrom && b < lastBeat;

    if (inDrums && (style === "pulse" || style === "house" || b % 2 === 0)) {
      kick(at, mg);
      duckAt(at);
    }
    if (inDrums && b % 2 === 1 && style !== "minimal") clap(at, mg);
    if (b < lastBeat) {
      hat(at + beatSec / 2, mg * (b >= drumsFrom ? 1 : 0.6), style === "house");
      if (style === "house" && inDrums) hat(at + beatSec * 0.75, mg * 0.5);
    }

    // Bass: eighth-note root pulse once drums are in
    if (inDrums) {
      const f = hz(rootMidi - 12 + chord[0]);
      for (const off of [0, 0.5]) {
        const s0 = Math.floor((at + off * beatSec) * SR);
        const n = Math.floor(beatSec * 0.48 * SR);
        let ph = 0;
        for (let i = 0; i < n && s0 + i < len; i++) {
          const t = i / SR;
          ph += (TAU * f) / SR;
          bass[s0 + i] += (Math.sin(ph) + 0.3 * Math.sin(ph * 2)) * Math.min(1, t * 200) * Math.exp(-t * 4) * 0.35 * mg;
        }
      }
    }

    // Pad: chord per bar, soft attack, detuned saws through a lowpass
    if (b % 4 === 0) {
      const dur = Math.min(4, tl.beats - b) * beatSec;
      const s0 = Math.floor(at * SR);
      const n = Math.floor(dur * SR);
      chord.forEach((semi, vi) => {
        const f = hz(rootMidi + 12 + semi);
        const lp = lowpass(1400);
        for (let i = 0; i < n && s0 + i < len; i++) {
          const t = i / SR;
          const saw = (x) => 2 * (x - Math.floor(x + 0.5));
          const v = saw(f * t) + saw(f * 1.004 * t) + saw(f * 0.996 * t);
          const env = Math.min(1, t / 0.4) * Math.min(1, (dur - t) / 0.3);
          pad[s0 + i] += lp(v / 3) * env * 0.07 * mg * (vi === 0 ? 1 : 0.8);
        }
      });
    }
  }

  for (let i = 0; i < len; i++) {
    const sc = sidechain[i];
    music.L[i] += (pad[i] + bass[i]) * sc;
    music.R[i] += (pad[i] * 0.92 + bass[i]) * sc;
  }
}

// ---------- SFX on cues ----------
target = sfx;
for (const [id, cue] of Object.entries(tl.cues)) {
  const kind = cue.sfx ?? "none";
  const fn = SFX[kind];
  if (!fn) fail(`cue "${id}": unknown sfx "${kind}". Known: ${Object.keys(SFX).join(", ")}`);
  fn(beatToSec(tl, cue.beat), cue.gain ?? 1);
}

// ---------- Voice-over (voiceover.json + public/<slug>/vo/*.wav) ----------
// Each line is decoded, levelled to a common RMS and placed at its cue. While a
// line plays, music ducks by duckMusicDb and SFX by duckSfxDb with smooth ramps.
const vo = loadVoiceover(slug, tl);
const duck = new Float32Array(len).fill(0); // 0 = no voice, 1 = voice fully active
if (vo) {
  const levelOf = (x) => Math.sqrt(x.reduce((s2, v) => s2 + v * v, 0) / Math.max(1, x.length));
  for (const line of vo.lines) {
    const pcm = decodeMono(line.file, SR);
    const norm = 0.12 / Math.max(1e-4, levelOf(pcm)); // about -18 dBFS RMS
    const s0 = Math.floor(line.start * SR);
    for (let i = 0; i < pcm.length && s0 + i < len; i++) {
      const v = pcm[i] * norm * vo.gain;
      voice.L[s0 + i] += v;
      voice.R[s0 + i] += v;
    }
    const a0 = Math.max(0, Math.floor((line.start - 0.12) * SR));
    const a1 = Math.min(len, s0 + pcm.length + Math.floor(0.25 * SR));
    for (let i = a0; i < a1; i++) duck[i] = 1;
  }
  // Smooth the gate: 120 ms attack, 350 ms release
  const att = 1 - Math.exp(-1 / (0.04 * SR));
  const rel = 1 - Math.exp(-1 / (0.12 * SR));
  let env = 0;
  for (let i = 0; i < len; i++) {
    env += (duck[i] > env ? att : rel) * (duck[i] - env);
    duck[i] = env;
  }
}
const dbToGain = (db) => Math.pow(10, db / 20);
const musicDuck = vo ? dbToGain(vo.duckMusicDb) : 1;
const sfxDuck = vo ? dbToGain(vo.duckSfxDb) : 1;

// ---------- Master: sum buses, soft clip, fade tail, normalise to -1 dBFS ----------
const L = new Float32Array(len);
const R = new Float32Array(len);
const fadeTail = Math.min(0.6, total * 0.05);
let peak = 0;
for (let i = 0; i < len; i++) {
  const t = i / SR;
  const f = t > total - fadeTail ? (total - t) / fadeTail : 1;
  const gm = 1 + (musicDuck - 1) * duck[i];
  const gs = 1 + (sfxDuck - 1) * duck[i];
  L[i] = Math.tanh((music.L[i] * gm + sfx.L[i] * gs + voice.L[i]) * 1.1) * f;
  R[i] = Math.tanh((music.R[i] * gm + sfx.R[i] * gs + voice.R[i]) * 1.1) * f;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = peak > 0 ? 0.891 / peak : 1;

const data = Buffer.alloc(len * 4);
for (let i = 0; i < len; i++) {
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * norm)) * 32767), i * 4);
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * norm)) * 32767), i * 4 + 2);
}
const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + data.length, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(2, 22);
header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(data.length, 40);

fs.mkdirSync(p.public, { recursive: true });
const out = path.join(p.public, "audio.wav");
fs.writeFileSync(out, Buffer.concat([header, data]));
console.log(
  `audio: ${path.relative(process.cwd(), out)}  ${total.toFixed(2)}s  ${tl.bpm} BPM  ${Object.keys(tl.cues).length} cues  style=${style}` +
    (vo ? `  voice-over: ${vo.lines.length} lines (${vo.lines.filter((l) => l.draft).length} draft)` : ""),
);
