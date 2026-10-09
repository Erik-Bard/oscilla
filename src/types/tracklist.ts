export type Track = {
  key: string;
  uri: string;
  name: string;
  artists: string;
  album: string | null;
  imageUrl: string | null;
  addedAt: string | null;
  durationMs: number;
  playable: boolean;
};

export type Tracklist = {
  kind: "album" | "playlist" | "likedSongs";
  typeLabel: string;
  name: string;
  owner: string;
  ownerId: string | null;
  year: string | null;
  imageUrl: string | null;
  total: number;
  tracks: Track[];
  next: string | null;
  tracksHidden?: boolean;
};
