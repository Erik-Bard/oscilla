import { albumLabel, coverUrl } from "./recents.ts";
import type { ApiLibraryPlaylist, ApiSavedAlbum } from "../types/spotify.ts";
import type { LibraryItem } from "../types/library.ts";

type Owner = { id: string; displayName: string };

export function likedSongsUri(listener: Owner) {
  return `spotify:user:${listener.id}:collection`;
}

export function libraryItems(
  listener: Owner,
  playlists: ApiLibraryPlaylist[],
  albums: ApiSavedAlbum[],
): LibraryItem[] {
  return [
    {
      uri: likedSongsUri(listener),
      kind: "likedSongs",
      name: "Liked Songs",
      typeLabel: "Playlist",
      by: listener.displayName,
      imageUrl: null,
    },
    ...playlists.flatMap((p) =>
      p && (p.owner.id === listener.id || p.collaborative)
        ? [
            {
              uri: p.uri,
              kind: "playlist" as const,
              name: p.name,
              typeLabel: "Playlist",
              by: p.owner.display_name ?? "Spotify",
              imageUrl: coverUrl(p.images ?? []),
            },
          ]
        : [],
    ),
    ...albums.map(({ album }) => ({
      uri: album.uri,
      kind: "album" as const,
      name: album.name,
      typeLabel: albumLabel(album.album_type),
      by: album.artists.map((a) => a.name).join(", "),
      imageUrl: coverUrl(album.images),
    })),
  ];
}

export function matches(query: string, ...fields: string[]) {
  const q = query.trim().toLowerCase();
  return !q || fields.some((field) => field.toLowerCase().includes(q));
}
