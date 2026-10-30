// Reads a product image through ffmpeg and reports what the layout and the
// design tokens need: size, aspect, whether it is a cut-out, edge colour, and a
// dominant-colour palette. Usage: node scripts/analyze-image.mjs <image>
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { FFMPEG, FFPROBE, fail } from "./lib.mjs";

const N = 64;

const hex = ([r, g, b]) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const lum = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const sat = ([r, g, b]) => {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  return mx === 0 ? 0 : (mx - mn) / mx;
};
const dist = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/** Deterministic k-means (seeded from evenly spaced samples). */
const kmeans = (pts, k) => {
  if (pts.length === 0) return [];
  let cent = Array.from({ length: k }, (_, i) => pts[Math.floor((i + 0.5) * (pts.length / k))]);
  let assign = new Array(pts.length).fill(0);
  for (let it = 0; it < 12; it++) {
    assign = pts.map((p) => {
      let best = 0;
      for (let c = 1; c < cent.length; c++) if (dist(p, cent[c]) < dist(p, cent[best])) best = c;
      return best;
    });
    cent = cent.map((c, ci) => {
      const mine = pts.filter((_, i) => assign[i] === ci);
      if (!mine.length) return c;
      return [0, 1, 2].map((ch) => mine.reduce((s, p) => s + p[ch], 0) / mine.length);
    });
  }
  return cent
    .map((c, ci) => ({ rgb: c, share: assign.filter((a) => a === ci).length / pts.length }))
    .sort((a, b) => b.share - a.share);
};

export const analyzeImage = (file) => {
  const probe = JSON.parse(
    execFileSync(FFPROBE, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,pix_fmt", "-of", "json", file]).toString(),
  );
  const s = probe.streams?.[0];
  if (!s) fail(`not an image ffmpeg can read: ${file}`);

  const raw = execFileSync(FFMPEG, ["-v", "error", "-i", file, "-vf", `scale=${N}:${N}:flags=area`, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "-"], {
    maxBuffer: 1 << 24,
  });
  const px = [];
  const edge = [];
  let clear = 0;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const o = (y * N + x) * 4;
      const p = [raw[o], raw[o + 1], raw[o + 2]];
      const a = raw[o + 3];
      if (a < 250) clear++;
      const isEdge = x < 2 || y < 2 || x >= N - 2 || y >= N - 2;
      if (isEdge && a >= 250) edge.push(p);
      if (a >= 250 && !isEdge) px.push(p);
    }
  }
  const transparent = clear / (N * N) > 0.02;
  const edgeMean = edge.length ? [0, 1, 2].map((c) => edge.reduce((s2, p) => s2 + p[c], 0) / edge.length) : null;
  const edgeSpread = edgeMean ? Math.sqrt(edge.reduce((s2, p) => s2 + dist(p, edgeMean), 0) / edge.length) : null;
  // For opaque photos, drop pixels close to the backdrop so the palette is the product.
  const subject = !transparent && edgeMean ? px.filter((p) => dist(p, edgeMean) > 40 ** 2) : px;

  return {
    width: s.width,
    height: s.height,
    aspect: +(s.width / s.height).toFixed(4),
    transparent,
    backdrop: transparent
      ? null
      : { color: edgeMean ? hex(edgeMean) : null, uniform: edgeSpread !== null && edgeSpread < 18 },
    palette: kmeans(subject.length > 30 ? subject : px, 6).map((c) => ({
      hex: hex(c.rgb),
      share: +c.share.toFixed(3),
      luminance: +lum(c.rgb).toFixed(3),
      saturation: +sat(c.rgb).toFixed(3),
    })),
  };
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file) fail("usage: node scripts/analyze-image.mjs <image>");
  console.log(JSON.stringify(analyzeImage(file), null, 2));
}
