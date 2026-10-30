// Narrated lesson pipeline: script.json -> ElevenLabs voice (with word timestamps) + sound effects
// + music bed -> karaoke.json (word timings the video reads) + audio.wav.
// Usage: npm run narrate -- <slug> [--speed 1.1] [--force] [--preview]
//   --preview  no API calls: estimated word timings and no audio (for layout checks only).
// The API key is read from ELEVENLABS_API_KEY (or ELEVEN_API_KEY / XI_API_KEY). Takes are cached in
// projects/<slug>/vo-raw so re-running only pays for sections whose text changed.
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { FFMPEG, assertSlug, fail, parseArgs, paths, readJson } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const slug = args._[0];
assertSlug(slug);
const p = paths(slug);
const script = readJson(path.join(p.project, "script.json"));
const speed = Number(args.speed ?? 1.1);
const preview = Boolean(args.preview);
const KEY = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY || process.env.XI_API_KEY;
if (!preview && !KEY) fail("no ElevenLabs key in the environment (ELEVENLABS_API_KEY). Use --preview for estimated timings.");

const API = "https://api.elevenlabs.io/v1";
const rawDir = path.join(p.project, "vo-raw");
const sfxDir = path.join(p.public, "sfx");
fs.mkdirSync(rawDir, { recursive: true });
fs.mkdirSync(sfxDir, { recursive: true });

const call = async (url, body) => {
  const res = await fetch(`${API}${url}`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) fail(`ElevenLabs ${url} -> HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res;
};

const norm = (w) => w.toLowerCase().replace(/[^a-z0-9’']/g, "");

// ---------- 1. voice takes ----------
const takes = {};
for (const s of script.sections) {
  const plain = s.text.split(/\s+/).filter(Boolean);
  if (preview) {
    let t = 0;
    takes[s.id] = {
      dur: 0,
      words: plain.map((w) => {
        const d = (0.12 + 0.045 * w.length) / speed;
        const o = { w, s: t, e: t + d };
        t += d + (/[,;:]$/.test(w) ? 0.28 : /[.?!]$/.test(w) ? 0.5 : 0.04);
        return o;
      }),
    };
    takes[s.id].dur = t;
    continue;
  }
  const voiceId = script.voices[s.voice].id;
  const hash = crypto.createHash("sha1").update(JSON.stringify([s.text, voiceId, speed])).digest("hex").slice(0, 10);
  const base = path.join(rawDir, `${s.id}-${hash}`);
  if (args.force || !fs.existsSync(`${base}.json`)) {
    const res = await call(`/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`, {
      text: s.text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true, speed },
    });
    const j = await res.json();
    fs.writeFileSync(`${base}.mp3`, Buffer.from(j.audio_base64, "base64"));
    fs.writeFileSync(`${base}.json`, JSON.stringify(j.alignment ?? j.normalized_alignment));
    console.log(`voice ${s.id}: generated`);
  } else console.log(`voice ${s.id}: cached`);
  const al = readJson(`${base}.json`);
  // Characters -> words (split on whitespace; the alignment keeps the original spacing).
  const words = [];
  let cur = null;
  al.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (cur) words.push(cur), (cur = null);
      return;
    }
    if (!cur) cur = { w: "", s: al.character_start_times_seconds[i], e: 0 };
    cur.w += ch;
    cur.e = al.character_end_times_seconds[i];
  });
  if (cur) words.push(cur);
  takes[s.id] = { mp3: `${base}.mp3`, dur: words.at(-1).e, words };
}

// ---------- 2. layout on the timeline ----------
const LEAD = 0.5; // before the first word
const GAP = 1.1; // between sections (transition)
const OUTRO = 4;
let t = LEAD;
const sections = script.sections.map((s) => {
  const tk = takes[s.id];
  const start = t;
  const words = tk.words.map((w) => ({ w: w.w, s: +(start + w.s).toFixed(3), e: +(start + w.e).toFixed(3) }));
  const end = start + tk.dur;
  const vocab = s.vocab.map((v) => {
    const keyTok = norm(v.key);
    let at = words.findIndex((w) => norm(w.w) === keyTok);
    if (at < 0) fail(`vocab key "${v.key}" not found in ${s.id}`);
    return { en: v.en, vi: v.vi, at, t: words[at].s };
  });
  t = end + GAP + (s.id === "p0" ? 2.4 : 0); // the cue card needs reading time
  return { id: s.id, heading: s.heading, start: +(start - 0.45).toFixed(3), voiceStart: +start.toFixed(3), end: +end.toFixed(3), words, vocab, mp3: tk.mp3 };
});
const total = Math.ceil((sections.at(-1).end + OUTRO) * 2) / 2;
sections.forEach((s, i) => {
  s.exit = +(i < sections.length - 1 ? sections[i + 1].start : total - OUTRO + 0.6).toFixed(3);
});
const karaoke = {
  title: script.title,
  kicker: script.kicker,
  topic: script.topic,
  estimated: preview,
  total,
  outroAt: +(sections.at(-1).exit).toFixed(3),
  sections: sections.map(({ mp3, ...s }) => s),
};
fs.writeFileSync(path.join(p.code, "karaoke.json"), JSON.stringify(karaoke, null, 1) + "\n");

// Timeline: 30 fps, 120 BPM grid (2 beats/s) sized to the narration.
const tlPath = p.timeline;
const tl = readJson(tlPath);
tl.fps = 30;
tl.beats = Math.ceil(total * 2);
tl.music = { style: "none", key: "A", gain: 0 };
tl.cues = { end: { beat: tl.beats, sfx: "none" } };
fs.writeFileSync(tlPath, JSON.stringify(tl, null, 2) + "\n");
console.log(`timeline: ${total.toFixed(1)} s, ${tl.beats} beats @ ${tl.fps} fps${preview ? " (estimated timings, no audio)" : ""}`);
if (preview) process.exit(0);

// ---------- 3. sounds: whoosh + pop + music bed (ElevenLabs) ----------
const makeSound = async (name, text, dur, influence = 0.5, loop = false) => {
  const out = path.join(sfxDir, `${name}.mp3`);
  if (fs.existsSync(out) && !args.force) return out;
  const res = await call("/sound-generation?output_format=mp3_44100_128", {
    text,
    duration_seconds: dur,
    prompt_influence: influence,
    ...(loop ? { loop: true } : {}),
  });
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  console.log(`sound ${name}: generated`);
  return out;
};
const whoosh = await makeSound("whoosh", "soft smooth airy whoosh transition, short, clean, no music", 1.0, 0.6);
const pop = await makeSound("pop", "single gentle soft UI pop bubble notification, very short, clean", 0.5, 0.6);
const bed = await makeSound("bed", "calm warm uplifting lo-fi study background instrumental, soft piano and gentle beat, seamless loop, no vocals", 22, 0.4, true);

// ---------- 4. mix ----------
const inputs = [];
const filters = [];
const add = (file, extra = []) => {
  inputs.push(...extra, "-i", file);
  return inputs.filter((x) => x === "-i").length - 1;
};
const labels = { voice: [], sfx: [] };
for (const s of sections) {
  const i = add(s.mp3);
  const ms = Math.round(s.voiceStart * 1000);
  filters.push(`[${i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms}[v${i}]`);
  labels.voice.push(`[v${i}]`);
  const w = add(whoosh);
  const wms = Math.round(Math.max(0, s.start - 0.05) * 1000);
  filters.push(`[${w}:a]aresample=48000,aformat=channel_layouts=stereo,volume=0.5,adelay=${wms}|${wms}[s${w}]`);
  labels.sfx.push(`[s${w}]`);
  for (const v of s.vocab) {
    const q = add(pop);
    const pms = Math.round((v.t + 0.1) * 1000);
    filters.push(`[${q}:a]aresample=48000,aformat=channel_layouts=stereo,volume=0.28,adelay=${pms}|${pms}[s${q}]`);
    labels.sfx.push(`[s${q}]`);
  }
}
const bi = add(bed, ["-stream_loop", "-1"]);
filters.push(`[${bi}:a]aresample=48000,aformat=channel_layouts=stereo,volume=0.55,atrim=0:${total}[bed]`);
filters.push(`${labels.voice.join("")}amix=inputs=${labels.voice.length}:normalize=0,asplit=2[voice][vsc]`);
filters.push(`${labels.sfx.join("")}amix=inputs=${labels.sfx.length}:normalize=0[sfx]`);
// Music ducks under the voice.
filters.push(`[bed][vsc]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[bedd]`);
filters.push(`[voice][bedd][sfx]amix=inputs=3:normalize=0:duration=longest,alimiter=limit=0.95,atrim=0:${total}[out]`);
const out = path.join(p.public, "audio.wav");
execFileSync(FFMPEG, ["-y", "-v", "error", ...inputs, "-filter_complex", filters.join(";"), "-map", "[out]", "-ar", "48000", "-ac", "2", out], { stdio: "inherit" });
console.log(`audio: ${out}`);
