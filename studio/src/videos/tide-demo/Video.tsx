import React from "react";
import { AbsoluteFill, Html5Audio, getStaticFiles, staticFile } from "remotion";
import { Background } from "../../components/Background";
import { Headline, Kicker } from "../../components/Headline";
import { ProductShot } from "../../components/ProductShot";
import { Badge, CTA, Callout, Cursor, type IconName } from "../../components/UI";
import type { Brand } from "../../lib/brand";
import { SPRINGS, enterExit, mix, springAt } from "../../lib/motion";
import { SceneProvider, useScene } from "../../lib/scene";
import type { Timeline } from "../../lib/timeline";
import brandJson from "./brand.json";
import contentJson from "./content.json";
import timelineJson from "./timeline.json";

export const SLUG = "tide-demo";
export const timeline = timelineJson as Timeline;
const brand = brandJson as Brand;

type Content = {
  product: string;
  kicker: string;
  hook: string;
  tagline: string;
  features: { icon: IconName; title: string; sub?: string; hotspot?: { x: number; y: number } | null }[];
  offer: { text: string; sub?: string } | null;
  cta: { label: string; url?: string };
  images: { src: string; aspect: number; transparent: boolean }[];
};
const content = contentJson as Content;

// Beat map (120 BPM, 2 beats/s):
//   0-3s   hook       scattered problem / promise headline
//   3-7s   reveal     hero product springs in, name + tagline
//   7-12s  features   product slides aside, three callouts land on the beat
//   12-15s close      offer badge + CTA, cursor clicks on the downbeat
const Scene: React.FC = () => {
  const { t, at, portrait, width, height, u } = useScene();
  const hero = content.images[0];

  // Product layout per act. Positions are canvas fractions; size is in u.
  const toFeatures = springAt(t - at("feat-move"), SPRINGS.glide);
  const toClose = springAt(t - at("close-move"), SPRINGS.glide);
  const heroX = portrait ? 0.5 : mix(mix(0.5, 0.3, toFeatures), 0.5, toClose);
  const heroY = portrait
    ? mix(mix(0.47, 0.34, toFeatures), 0.36, toClose)
    : mix(mix(0.5, 0.52, toFeatures), 0.4, toClose);
  const heroSize = portrait ? mix(mix(760, 640, toFeatures), 620, toClose) : mix(mix(720, 660, toFeatures), 470, toClose);

  // Convert a hotspot on the product image (0..1) into canvas fractions.
  const hotspot = (hs: { x: number; y: number }) => {
    const h = heroSize * u;
    const w = h * hero.aspect;
    return {
      x: (heroX * width - w / 2 + hs.x * w) / width,
      y: (heroY * height - h / 2 + hs.y * h) / height,
    };
  };

  // Landscape: a left-aligned column beside the product. Portrait: centred stack below it.
  // Order features top-to-bottom by hotspot y so leader lines never cross.
  const featureSlots = portrait
    ? [
        { x: 0.5, y: 0.64 },
        { x: 0.5, y: 0.745 },
        { x: 0.5, y: 0.85 },
      ]
    : [
        { x: 0.5, y: 0.3 },
        { x: 0.5, y: 0.5 },
        { x: 0.5, y: 0.7 },
      ];
  const featureCues = ["feat-1", "feat-2", "feat-3"];

  const bloom = enterExit(t, at("hero-in"), at("feat-move"), SPRINGS.hero, SPRINGS.glide);

  return (
    <AbsoluteFill>
      <Background energy={bloom} />

      {/* Act 1: hook */}
      <Kicker text={content.kicker} enterAt={at("hook-in")} exitAt={at("hook-out")} x={0.5} y={portrait ? 0.4 : 0.36} />
      <Headline
        text={content.hook}
        enterAt={at("hook-in") + 0.15}
        exitAt={at("hook-out")}
        size={portrait ? 112 : 120}
        x={0.5}
        y={0.5}
        maxWidth={portrait ? 0.86 : 0.75}
      />

      {/* Act 2-4: product */}
      <ProductShot
        src={hero.src}
        transparent={hero.transparent}
        aspect={hero.aspect}
        enterAt={at("hero-in")}
        x={heroX}
        y={heroY}
        size={heroSize}
        shineAt={at("hero-shine")}
        from={{ dy: 260, rotate: -8, scale: 0.8 }}
      />
      {content.images.slice(1, 3).map((img, i) => (
        <ProductShot
          key={img.src}
          src={img.src}
          transparent={img.transparent}
          aspect={img.aspect}
          enterAt={at("close-move") + 0.2 + i * 0.12}
          x={portrait ? 0.5 + (i === 0 ? -0.3 : 0.3) : 0.5 + (i === 0 ? -0.26 : 0.26)}
          y={portrait ? 0.4 : 0.42}
          size={portrait ? 360 : 340}
          from={{ dx: i === 0 ? 200 : -200, dy: 40, rotate: i === 0 ? 10 : -10 }}
          spring={SPRINGS.card}
        />
      ))}

      <Headline
        text={content.product}
        enterAt={at("name-in")}
        exitAt={at("feat-move")}
        size={portrait ? 96 : 84}
        x={0.5}
        y={portrait ? 0.8 : 0.86}
        maxWidth={0.9}
      />
      <Headline
        text={content.tagline}
        enterAt={at("name-in") + 0.3}
        exitAt={at("feat-move")}
        size={portrait ? 40 : 36}
        weight={500}
        font="body"
        color={brand.colors.muted}
        x={0.5}
        y={portrait ? 0.86 : 0.93}
        maxWidth={0.9}
        gap={0.025}
      />

      {/* Act 3: features */}
      {content.features.slice(0, 3).map((f, i) => (
        <Callout
          key={f.title}
          icon={f.icon}
          title={f.title}
          sub={f.sub}
          enterAt={at(featureCues[i])}
          exitAt={at("close-move")}
          x={featureSlots[i].x}
          y={featureSlots[i].y}
          anchor={portrait ? "center" : "left"}
          scale={portrait ? 1.3 : 1.35}
          target={!portrait && f.hotspot ? hotspot(f.hotspot) : null}
        />
      ))}

      {/* Act 4: offer + CTA */}
      {content.offer ? (
        <Badge
          text={content.offer.text}
          sub={content.offer.sub}
          enterAt={at("offer-in")}
          x={portrait ? 0.76 : 0.64}
          y={portrait ? 0.2 : 0.2}
        />
      ) : null}
      <Headline
        text={content.product}
        enterAt={at("close-move") + 0.3}
        size={portrait ? 84 : 72}
        x={0.5}
        y={portrait ? 0.62 : 0.68}
        maxWidth={0.9}
      />
      <CTA
        label={content.cta.label}
        url={content.cta.url}
        enterAt={at("cta-in")}
        pressAt={at("cta-click")}
        x={0.5}
        y={portrait ? 0.74 : 0.82}
      />
      <Cursor
        enterAt={at("cursor-in")}
        exitAt={at("cta-click") + 0.9}
        keys={[
          { t: at("cursor-in"), x: portrait ? 0.85 : 0.8, y: portrait ? 0.95 : 0.98 },
          { t: at("cta-click") - 0.05, x: 0.53, y: portrait ? 0.745 : 0.83, click: true },
        ]}
      />
    </AbsoluteFill>
  );
};

const audioPath = `${SLUG}/audio.wav`;

export const Component: React.FC = () => (
  <SceneProvider brand={brand} timeline={timeline}>
    <Scene />
    {getStaticFiles().some((f) => f.name === audioPath) ? <Html5Audio src={staticFile(audioPath)} /> : null}
  </SceneProvider>
);
