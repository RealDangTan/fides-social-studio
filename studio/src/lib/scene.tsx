import React, { createContext, useContext } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { Brand } from "./brand";
import { fontFamily } from "./fonts";
import { makeCues, type Timeline } from "./timeline";

type SceneValue = {
  brand: Brand;
  timeline: Timeline;
  display: string;
  body: string;
};

const SceneContext = createContext<SceneValue | null>(null);

export const SceneProvider: React.FC<{
  brand: Brand;
  timeline: Timeline;
  children: React.ReactNode;
}> = ({ brand, timeline, children }) => {
  const value: SceneValue = {
    brand,
    timeline,
    display: fontFamily(brand.font.display),
    body: fontFamily(brand.font.body),
  };
  return <SceneContext.Provider value={value}>{children}</SceneContext.Provider>;
};

/**
 * Everything a component needs to render itself as f(t).
 * `u` is a layout unit: 1u = 1px on the short side of a 1080 canvas, so the same
 * component code lays out correctly in 16:9 and 9:16.
 */
export const useScene = () => {
  const ctx = useContext(SceneContext);
  if (!ctx) throw new Error("useScene() must be used inside <SceneProvider>");
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const portrait = height > width;
  const u = Math.min(width, height) / 1080;
  return {
    ...ctx,
    frame,
    fps,
    t: frame / fps,
    width,
    height,
    portrait,
    u,
    at: makeCues(ctx.timeline),
  };
};
