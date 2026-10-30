// Shared paths and render settings for the studio scripts.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Render with the locally installed Brave (new headless mode). Never download Chrome.
export const BROWSER =
  process.env.REMOTION_BROWSER_EXECUTABLE ??
  "/opt/pw-browsers/chromium";
export const CHROME_MODE = "chrome-for-testing";

export const FORMATS = ["16x9", "9x16"];

export const paths = (slug) => {
  const project = path.join(STUDIO, "projects", slug);
  return {
    project,
    sources: path.join(project, "sources"),
    drafts: path.join(project, "drafts"),
    critique: path.join(project, "critique"),
    published: path.join(project, "published"),
    code: path.join(STUDIO, "src", "videos", slug),
    public: path.join(STUDIO, "public", slug),
    timeline: path.join(STUDIO, "src", "videos", slug, "timeline.json"),
  };
};

export const assertSlug = (slug) => {
  if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    fail(`slug must be lowercase letters, digits and dashes, got "${slug ?? ""}"`);
  }
};

export const fail = (msg) => {
  console.error(`error: ${msg}`);
  process.exit(1);
};

/** Prefer a system ffmpeg on PATH, fall back to the one Remotion ships. */
const bin = (name) => {
  const bundled = path.join(STUDIO, "node_modules", "@remotion", "compositor-win32-x64-msvc", `${name}.exe`);
  try {
    execFileSync(name, ["-version"], { stdio: "ignore" });
    return name;
  } catch {
    if (fs.existsSync(bundled)) return bundled;
    fail(`${name} not found on PATH or in Remotion's compositor package`);
  }
};
export const FFMPEG = bin("ffmpeg");
export const FFPROBE = bin("ffprobe");

/** Minimal --flag value / --flag parser. Positional args land in `_`. */
export const parseArgs = (argv) => {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    } else out._.push(a);
  }
  return out;
};

export const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
export const beatToSec = (tl, beat) => (beat * 60) / tl.bpm;

/** Bundle the studio once; reuse the serve URL for many stills / renders. */
export const bundleStudio = async () => {
  const { bundle } = await import("@remotion/bundler");
  process.stdout.write("bundling... ");
  const url = await bundle({ entryPoint: path.join(STUDIO, "src", "index.ts"), publicDir: path.join(STUDIO, "public") });
  console.log("done");
  return url;
};

export const pickComposition = async (serveUrl, id) => {
  const { selectComposition } = await import("@remotion/renderer");
  return selectComposition({ serveUrl, id, browserExecutable: BROWSER, chromeMode: CHROME_MODE });
};
