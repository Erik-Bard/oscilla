import type { Credit } from "./tracklist.ts";

export type NowPlaying = {
  contextUri: string | null;
  trackUri: string;
  name: string;
  artists: Credit[];
  imageUrl: string | null;
  paused: boolean;
  durationMs: number;
  positionMs: number;
  reportedAt: number;
};
