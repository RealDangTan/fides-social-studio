// Scaffold a new product video from product images.
// Usage: npm run new -- <slug> --product "Product Name" <image> [image...]
//
// Creates
//   projects/<slug>/sources/     untouched client images (never edited)
//   projects/<slug>/drafts/      experiments, scratch renders
//   projects/<slug>/critique/    checkpoint stills + review notes per pass
//   projects/<slug>/published/   final masters only
//   projects/<slug>/brief.md, storyboard.xml, assets.json
//   public/<slug>/               images the composition loads (+ audio.wav)
//   src/videos/<slug>/           composition code, copied from _template
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { analyzeImage } from "./analyze-image.mjs";
import { STUDIO, assertSlug, fail, parseArgs, paths } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const [slug, ...images] = args._;
assertSlug(slug);
const product = typeof args.product === "string" ? args.product : slug;
if (!images.length) fail("pass at least one product image");

const p = paths(slug);
if (fs.existsSync(p.code)) fail(`src/videos/${slug} already exists; pick a new slug or edit it in place`);

for (const dir of [p.sources, p.drafts, p.critique, p.published, p.public]) fs.mkdirSync(dir, { recursive: true });

const assets = images.map((src, i) => {
  if (!fs.existsSync(src)) fail(`image not found: ${src}`);
  const ext = path.extname(src).toLowerCase();
  const name = `product-${i + 1}${ext}`;
  fs.copyFileSync(src, path.join(p.sources, path.basename(src)));
  fs.copyFileSync(src, path.join(p.public, name));
  return { src: `${slug}/${name}`, original: path.basename(src), ...analyzeImage(src) };
});
fs.writeFileSync(path.join(p.project, "assets.json"), JSON.stringify(assets, null, 2) + "\n");

// Composition code from the template
const tpl = path.join(STUDIO, "src", "videos", "_template");
fs.mkdirSync(p.code, { recursive: true });
for (const f of fs.readdirSync(tpl)) {
  const text = fs.readFileSync(path.join(tpl, f), "utf8").replaceAll("__SLUG__", slug).replaceAll("__PRODUCT__", product);
  fs.writeFileSync(path.join(p.code, f), text);
}
const contentPath = path.join(p.code, "content.json");
const content = JSON.parse(fs.readFileSync(contentPath, "utf8"));
content.images = assets.map((a) => ({ src: a.src, aspect: a.aspect, transparent: a.transparent }));
fs.writeFileSync(contentPath, JSON.stringify(content, null, 2) + "\n");

// Project docs from templates
for (const f of ["brief.md", "storyboard.xml"]) {
  const text = fs.readFileSync(path.join(STUDIO, "templates", f), "utf8").replaceAll("__SLUG__", slug).replaceAll("__PRODUCT__", product);
  fs.writeFileSync(path.join(p.project, f), text);
}

// Register both compositions
const registry = path.join(STUDIO, "src", "videos", "index.ts");
const ident = "V_" + slug.replace(/-/g, "_");
let reg = fs.readFileSync(registry, "utf8");
reg = reg.replace(
  "// <registry-imports>",
  `import * as ${ident} from "./${slug}/Video";\n// <registry-imports>`,
);
reg = reg.replace(
  "  // <registry-entries>",
  `  { slug: ${ident}.SLUG, timeline: ${ident}.timeline, Component: ${ident}.Component },\n  // <registry-entries>`,
);
fs.writeFileSync(registry, reg);

execFileSync(process.execPath, [path.join(STUDIO, "scripts", "synth-audio.mjs"), slug], { stdio: "inherit" });

console.log(`\ncreated ${slug}`);
console.log(`  compositions: ${slug}-16x9, ${slug}-9x16`);
console.log(`  edit:         src/videos/${slug}/{content,brand,timeline}.json, Video.tsx`);
console.log(`  brief:        projects/${slug}/brief.md`);
console.log(`  assets:       projects/${slug}/assets.json`);
for (const a of assets) {
  const top = a.palette.slice(0, 4).map((c) => c.hex).join(" ");
  console.log(`    ${a.src}  ${a.width}x${a.height}  ${a.transparent ? "cut-out" : `opaque (backdrop ${a.backdrop?.color}${a.backdrop?.uniform ? ", uniform" : ""})`}  ${top}`);
}
