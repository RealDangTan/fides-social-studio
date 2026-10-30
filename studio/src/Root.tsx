import React from "react";
import { Composition } from "remotion";
import { durationInFrames } from "./lib/timeline";
import { VIDEOS } from "./videos";

// Every video is registered twice: a 16:9 master and a 9:16 vertical cut.
// Composition ids: <slug>-16x9 and <slug>-9x16.
export const FORMATS = {
  "16x9": { width: 1920, height: 1080 },
  "9x16": { width: 1080, height: 1920 },
} as const;

export const RemotionRoot: React.FC = () => (
  <>
    {VIDEOS.flatMap((v) =>
      Object.entries(FORMATS).map(([fmt, size]) => (
        <Composition
          key={`${v.slug}-${fmt}`}
          id={`${v.slug}-${fmt}`}
          component={v.Component}
          fps={v.timeline.fps}
          durationInFrames={durationInFrames(v.timeline)}
          width={size.width}
          height={size.height}
        />
      )),
    )}
  </>
);
