import type React from "react";
import type { Timeline } from "../lib/timeline";
import * as V_tide_demo from "./tide-demo/Video";
import * as V_abc_airfryer from "./abc-airfryer/Video";
import * as V_fides_intro from "./fides-intro/Video";
import * as V_ielts_famous_person from "./ielts-famous-person/Video";
// <registry-imports> new-video.mjs inserts imports above this line

export type VideoEntry = { slug: string; timeline: Timeline; Component: React.FC };

export const VIDEOS: VideoEntry[] = [
  { slug: V_tide_demo.SLUG, timeline: V_tide_demo.timeline, Component: V_tide_demo.Component },
  { slug: V_abc_airfryer.SLUG, timeline: V_abc_airfryer.timeline, Component: V_abc_airfryer.Component },
  { slug: V_fides_intro.SLUG, timeline: V_fides_intro.timeline, Component: V_fides_intro.Component },
  { slug: V_ielts_famous_person.SLUG, timeline: V_ielts_famous_person.timeline, Component: V_ielts_famous_person.Component },
  // <registry-entries> new-video.mjs inserts entries above this line
];
