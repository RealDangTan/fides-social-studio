// The timeline is the single source of truth for both picture and sound.
// Cues are placed on a beat grid; components ask "when does cue X fire?" and
// scripts/synth-audio.mjs reads the same JSON to place SFX. Move a cue and the
// motion and its sound move together.

export type Sfx =
  | "click"
  | "tick"
  | "pop"
  | "whoosh"
  | "swoosh-rev"
  | "riser"
  | "drop"
  | "chime"
  | "shimmer"
  | "thud"
  | "sizzle"
  | "none";

export type Cue = {
  /** Position on the beat grid (quarter notes, 0-based). Fractions allowed: 4.5 = an eighth after beat 4. */
  beat: number;
  sfx?: Sfx;
  /** Linear gain for the SFX, default 1. */
  gain?: number;
  /** Free-form note for the storyboard / critique pass. */
  note?: string;
};

export type Timeline = {
  fps: number;
  bpm: number;
  /** Total length in beats. 15 s at 120 BPM = 30 beats. */
  beats: number;
  /** Music bed. "none" leaves only SFX; "track" mixes public/<slug>/music.wav (see scripts/music.mjs). */
  music: {
    style: "pulse" | "minimal" | "house" | "none" | "track";
    /** Root note of the bassline, e.g. "A", "F#". */
    key: string;
    gain: number;
  };
  cues: Record<string, Cue>;
};

export const beatToSec = (tl: Timeline, beat: number) => (beat * 60) / tl.bpm;
export const beatToFrame = (tl: Timeline, beat: number) => Math.round(beatToSec(tl, beat) * tl.fps);
export const durationInFrames = (tl: Timeline) => beatToFrame(tl, tl.beats);

/** Seconds at which a cue fires. Throws on typos so a misspelled cue never silently lands at 0. */
export const cueSec = (tl: Timeline, id: string) => {
  const cue = tl.cues[id];
  if (!cue) throw new Error(`Unknown cue "${id}". Known: ${Object.keys(tl.cues).join(", ")}`);
  return beatToSec(tl, cue.beat);
};

/** Bound helper so components can write `at("hero-in")`. */
export const makeCues = (tl: Timeline) => (id: string) => cueSec(tl, id);
