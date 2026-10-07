import { albumLabel, coverUrl, type SpotifyImage } from "./recents.ts";

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
};

type ApiTrack = {
  uri: string;
  name: string;
  duration_ms: number;
  is_playable?: boolean;
  is_local?: boolean;
  artists?: { name: string }[];
  show?: { name: string };
  album?: { name: string; images: SpotifyImage[] };
  images?: SpotifyImage[];
};

type PlaylistEntry = {
  added_at: string | null;
  is_local?: boolean;
  track?: ApiTrack | null;
  item?: ApiTrack | null;
};

export type ApiPage<T> = { items: T[]; next: string | null; total: number };

export type ApiAlbum = {
  name: string;
  album_type: string;
  release_date: string;
  images: SpotifyImage[];
  artists: { name: string }[];
  tracks: ApiPage<ApiTrack>;
};

export type ApiPlaylist = {
  name: string;
  public: boolean | null;
  images: SpotifyImage[] | null;
  owner: { id: string; display_name: string | null };
  tracks?: ApiPage<PlaylistEntry>;
  items?: ApiPage<PlaylistEntry>;
};

export type ApiSavedTracks = ApiPage<{ added_at: string; track: ApiTrack }>;

function toTrack(
  track: ApiTrack,
  addedAt: string | null,
  index: number,
  isLocal = false,
): Track {
  return {
    key: `${index}:${track.uri}`,
    uri: track.uri,
    name: track.name,
    artists:
      track.artists?.map((a) => a.name).join(", ") || track.show?.name || "",
    album: track.album?.name ?? null,
    imageUrl: coverUrl(track.album?.images ?? track.images ?? []),
    addedAt,
    durationMs: track.duration_ms,
    playable: !isLocal && !track.is_local && track.is_playable !== false,
  };
}

export function albumTracks(page: ApiPage<ApiTrack>, offset: number) {
  return page.items.map((track, i) => toTrack(track, null, offset + i));
}

export function playlistTracks(page: ApiPage<PlaylistEntry>, offset: number) {
  return page.items.flatMap((entry, i) => {
    const track = entry.track ?? entry.item;
    return track
      ? [toTrack(track, entry.added_at, offset + i, entry.is_local)]
      : [];
  });
}

export function savedTracks(page: ApiSavedTracks, offset: number) {
  return page.items.map((entry, i) =>
    toTrack(entry.track, entry.added_at, offset + i),
  );
}

export function fromAlbum(album: ApiAlbum): Tracklist {
  return {
    kind: "album",
    typeLabel: albumLabel(album.album_type),
    name: album.name,
    owner: album.artists.map((a) => a.name).join(", "),
    ownerId: null,
    year: album.release_date.slice(0, 4),
    imageUrl: coverUrl(album.images),
    total: album.tracks.total,
    tracks: albumTracks(album.tracks, 0),
    next: album.tracks.next,
  };
}

export function fromPlaylist(playlist: ApiPlaylist): Tracklist {
  const page = playlist.tracks ?? playlist.items;
  return {
    kind: "playlist",
    typeLabel: playlist.public ? "Public Playlist" : "Playlist",
    name: playlist.name,
    owner: playlist.owner.display_name ?? "Spotify",
    ownerId: playlist.owner.id,
    year: null,
    imageUrl: coverUrl(playlist.images ?? []),
    total: page?.total ?? 0,
    tracks: page ? playlistTracks(page, 0) : [],
    next: page?.next ?? null,
  };
}

export function fromSavedTracks(
  page: ApiSavedTracks,
  listenerName: string,
): Tracklist {
  return {
    kind: "likedSongs",
    typeLabel: "Playlist",
    name: "Liked Songs",
    owner: listenerName,
    ownerId: null,
    year: null,
    imageUrl: null,
    total: page.total,
    tracks: savedTracks(page, 0),
    next: page.next,
  };
}

export function formatTotal(ms: number) {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60)
    return `${Math.floor(ms / 60_000)} min ${Math.floor((ms % 60_000) / 1000)} sec`;
  return `about ${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
}

export function formatDuration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
