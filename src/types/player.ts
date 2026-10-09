export type NowPlaying = {
  contextUri: string | null;
  trackUri: string;
  name: string;
  artists: string;
  imageUrl: string | null;
  paused: boolean;
  durationMs: number;
  positionMs: number;
  reportedAt: number;
};
