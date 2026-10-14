export type Credit = { name: string; uri: string | null };

export type Track = {
  key: string;
  uri: string;
  name: string;
  artists: Credit[];
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
  artists?: Credit[];
  ownerId: string | null;
  year: string | null;
  imageUrl: string | null;
  total: number;
  tracks: Track[];
  next: string | null;
  tracksHidden?: boolean;
  snapshotId?: string;
  fetchedAt?: number;
};
