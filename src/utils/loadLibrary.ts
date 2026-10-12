import { libraryKey, writeCached } from "./cache.ts";
import { libraryItems } from "./library.ts";
import { getJson } from "./spotify.ts";
import type {
  ApiLibraryPlaylist,
  ApiPage,
  ApiSavedAlbum,
} from "../types/spotify.ts";
import type { LibraryItem } from "../types/library.ts";
import type { Listener } from "../types/session.ts";

const PAGE = 50;

async function loadAll<T>(path: string): Promise<T[]> {
  const first = await getJson<ApiPage<T>>(`${path}?limit=${PAGE}`);
  const offsets = [];
  for (let offset = PAGE; offset < first.total; offset += PAGE)
    offsets.push(offset);
  const rest = await Promise.all(
    offsets.map((offset) =>
      getJson<ApiPage<T>>(`${path}?limit=${PAGE}&offset=${offset}`),
    ),
  );
  return [first, ...rest].flatMap((page) => page.items);
}

async function fetchLibrary(listener: Listener) {
  const [playlists, albums] = await Promise.all([
    loadAll<ApiLibraryPlaylist>("/me/playlists"),
    loadAll<ApiSavedAlbum>("/me/albums"),
  ]);
  const items = libraryItems(listener, playlists, albums);
  void writeCached(libraryKey(listener.id), items);
  return items;
}

let fetchedThisLaunch:
  { listenerId: string; items: Promise<LibraryItem[]> } | undefined;

export function freshLibrary(listener: Listener, again = false) {
  if (again || fetchedThisLaunch?.listenerId !== listener.id) {
    const fetching = { listenerId: listener.id, items: fetchLibrary(listener) };
    fetching.items.catch(() => {
      if (fetchedThisLaunch === fetching) fetchedThisLaunch = undefined;
    });
    fetchedThisLaunch = fetching;
  }
  return fetchedThisLaunch.items;
}
