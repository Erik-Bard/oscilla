import { albumLabel, coverUrl } from "./recents.ts";
import type {
  ApiAlbum,
  ApiArtistRef,
  ApiPage,
  ApiPlaylist,
  ApiSavedTracks,
  ApiTrack,
  PlaylistEntry,
} from "../types/spotify.ts";
import type { Credit, Track, Tracklist } from "../types/tracklist.ts";

export function credits(artists: ApiArtistRef[]): Credit[] {
  return artists.map((a) => ({ name: a.name, uri: a.uri ?? null }));
}

export function isArtistUri(uri: string | null): uri is string {
  return !!uri?.startsWith("spotify:artist:");
}

export function creditNames(artists: Credit[]) {
  return artists.map((a) => a.name).join(", ");
}

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
    artists: track.artists?.length
      ? credits(track.artists)
      : track.show
        ? [{ name: track.show.name, uri: null }]
        : [],
    album: track.album?.name ?? null,
    imageUrl: coverUrl(track.album?.images ?? track.images ?? []),
    addedAt,
    durationMs: track.duration_ms,
    playable: !isLocal && !track.is_local && track.is_playable !== false,
  };
}

export function popularTracks(
  pages: ApiPage<ApiTrack>[],
  artistUri: string,
  count: number,
) {
  const names = new Set<string>();
  return pages
    .flatMap((page) => page.items)
    .filter((track) => {
      const byArtist = track.artists?.some((a) => a.uri === artistUri);
      const name = track.name.toLowerCase();
      if (!byArtist || names.has(name)) return false;
      names.add(name);
      return true;
    })
    .slice(0, count)
    .map((track, i) => toTrack(track, null, i));
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
    artists: credits(album.artists),
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
    tracksHidden: !page,
    snapshotId: playlist.snapshot_id,
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
