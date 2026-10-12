import { forgetCached, readCached, writeCached } from "./cache.ts";
import { tracklistIsCurrent, reconciled } from "./freshness.ts";
import { API_ROOT, getJson } from "./spotify.ts";
import {
  albumTracks,
  fromAlbum,
  fromPlaylist,
  fromSavedTracks,
  playlistTracks,
  savedTracks,
} from "./tracklist.ts";
import type {
  ApiAlbum,
  ApiPage,
  ApiPlaylist,
  ApiSavedTracks,
} from "../types/spotify.ts";
import type { Tracklist } from "../types/tracklist.ts";
import type { Listener } from "../types/session.ts";

const PAGE = 50;

function cacheKey(uri: string) {
  return `tracklist:${uri}`;
}

export function isUnavailable(error: unknown) {
  return (
    error instanceof Error &&
    (error.message === "403" || error.message === "404")
  );
}

async function firstPage(uri: string, listener: Listener): Promise<Tracklist> {
  const id = uri.split(":").pop();
  const list = uri.endsWith(":collection")
    ? fromSavedTracks(
        await getJson<ApiSavedTracks>(
          `/me/tracks?limit=${PAGE}&market=from_token`,
        ),
        listener.displayName,
      )
    : uri.startsWith("spotify:album:")
      ? fromAlbum(await getJson<ApiAlbum>(`/albums/${id}?market=from_token`))
      : fromPlaylist(
          await getJson<ApiPlaylist>(`/playlists/${id}?market=from_token`),
        );
  return { ...list, fetchedAt: Date.now() };
}

export function rememberTracklist(uri: string, list: Tracklist) {
  void writeCached(cacheKey(uri), list);
}

export async function openTracklist(
  uri: string,
  listener: Listener,
  show: (list: Tracklist) => void,
) {
  const cached = (await readCached<Tracklist>(cacheKey(uri)))?.value;
  if (cached) show(cached);
  if (cached && tracklistIsCurrent(cached, Date.now())) return;
  try {
    show(reconciled(cached, await firstPage(uri, listener)));
  } catch (error) {
    if (isUnavailable(error)) void forgetCached(cacheKey(uri));
    if (!cached || isUnavailable(error)) throw error;
  }
}

export function refreshTracklist(uri: string, listener: Listener) {
  return firstPage(uri, listener);
}

export async function loadMore(list: Tracklist): Promise<Tracklist> {
  if (!list.next) return list;
  const page = await getJson<ApiPage<never>>(list.next.replace(API_ROOT, ""));
  const offset = list.tracks.length;
  const more =
    list.kind === "album"
      ? albumTracks(page, offset)
      : list.kind === "playlist"
        ? playlistTracks(page, offset)
        : savedTracks(page, offset);
  return { ...list, tracks: [...list.tracks, ...more], next: page.next };
}
