import type { Play } from "./spotify.ts";

type Played = { uri: string; playedAt: string };

export type Candidate = Played &
  (
    | { kind: "album"; album: Play["track"]["album"] }
    | { kind: "playlist" }
    | { kind: "likedSongs" }
  );
