import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Equalizer,
  HeartIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  SearchIcon,
} from "../components/icons";
import { libraryItems, likedSongsUri, matches } from "../utils/library";
import { usePlayer } from "../context/player";
import { API_ROOT, getJson, spotifyFetch } from "../utils/spotify";
import {
  formatDuration,
  fromSavedTracks,
  savedTracks,
} from "../utils/tracklist";
import { useFocusedLoad } from "../hooks/useFocusedLoad";
import type {
  ApiLibraryPlaylist,
  ApiPage,
  ApiSavedAlbum,
  ApiSavedTracks,
} from "../types/spotify";
import type { LibraryItem } from "../types/library";
import type { Tracklist } from "../types/tracklist";
import type { Listener } from "../types/session";

const PAGE = 50;

type Filter = LibraryItem["kind"] | "all";

const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["playlist", "Playlists"],
  ["album", "Albums"],
  ["likedSongs", "Liked Songs"],
];

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

async function loadLibrary(listener: Listener) {
  const [playlists, albums] = await Promise.all([
    loadAll<ApiLibraryPlaylist>("/me/playlists"),
    loadAll<ApiSavedAlbum>("/me/albums"),
  ]);
  return libraryItems(listener, playlists, albums);
}

function CoverRow({
  name,
  label,
  imageUrl,
  liked,
  current,
  playing,
  trailing,
  onOpen,
  onPlay,
}: {
  name: string;
  label: string;
  imageUrl: string | null;
  liked?: boolean;
  current: boolean;
  playing: boolean;
  trailing?: string;
  onOpen: () => void;
  onPlay: () => void;
}) {
  return (
    <li
      className={`recent${current ? " current" : ""}${current && !playing ? " is-paused" : ""}`}
    >
      <button
        className="recent-open"
        aria-label={`Open ${name}`}
        onClick={onOpen}
      />
      <button
        className="cover-play"
        aria-label={`${playing ? "Pause" : "Play"} ${name}`}
        onClick={onPlay}
      >
        {liked ? (
          <span className="cover liked-cover">
            <HeartIcon size={16} />
          </span>
        ) : imageUrl ? (
          <img className="cover" src={imageUrl} alt="" loading="lazy" />
        ) : (
          <span className="cover" />
        )}
        <span className="cover-overlay">
          <span>
            {playing ? <PauseIcon size={12} /> : <PlayIcon size={12} />}
          </span>
        </span>
      </button>
      <span className="recent-meta">
        <span className="recent-name">
          {current && <Equalizer />}
          {name}
        </span>
        <span className="recent-label">{label}</span>
      </span>
      {trailing && <span className="recent-when">{trailing}</span>}
    </li>
  );
}

function SkeletonRows() {
  return (
    <ul className="recents compact skeleton" aria-label="Loading">
      {Array.from({ length: 8 }, (_, i) => (
        <li key={i} className="recent">
          <span className="cover" />
          <span className="recent-meta">
            <span className="bar" style={{ width: `${56 - i * 4}%` }} />
            <span className="bar" style={{ width: "28%" }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function Items({
  items,
  query,
  onOpen,
}: {
  items: LibraryItem[];
  query: string;
  onOpen: (uri: string) => void;
}) {
  const { nowPlaying, play, togglePlay } = usePlayer();
  if (items.length === 0)
    return (
      <p className="notice-detail">
        {query
          ? `Nothing in your Library matches “${query}”.`
          : "Nothing here yet."}
      </p>
    );
  return (
    <ul className="recents compact">
      {items.map((item) => {
        const current = nowPlaying?.contextUri === item.uri;
        return (
          <CoverRow
            key={item.uri}
            name={item.name}
            label={`${item.typeLabel} · ${item.by}`}
            imageUrl={item.imageUrl}
            liked={item.kind === "likedSongs"}
            current={current}
            playing={current && !nowPlaying.paused}
            onOpen={() => onOpen(item.uri)}
            onPlay={() => (current ? togglePlay() : play(item.uri))}
          />
        );
      })}
    </ul>
  );
}

function LikedSongs({
  listener,
  query,
}: {
  listener: Listener;
  query: string;
}) {
  const uri = likedSongsUri(listener);
  const [list, setList] = useState<Tracklist | null>(null);
  const [failed, setFailed] = useState(false);
  const [nearEnd, setNearEnd] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const { nowPlaying, play, togglePlay } = usePlayer();
  const searching = query.trim() !== "";
  const next = list?.next;

  useEffect(() => {
    getJson<ApiSavedTracks>(`/me/tracks?limit=${PAGE}&market=from_token`).then(
      (page) => setList(fromSavedTracks(page, listener.displayName)),
      () => setFailed(true),
    );
  }, [listener]);

  useEffect(() => {
    if (!sentinel.current) return;
    const observer = new IntersectionObserver(([entry]) =>
      setNearEnd(entry.isIntersecting),
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [next]);

  useEffect(() => {
    if (!next || !(nearEnd || searching)) return;
    let cancelled = false;
    getJson<ApiSavedTracks>(next.replace(API_ROOT, "")).then(
      (page) => {
        if (!cancelled)
          setList(
            (prev) =>
              prev && {
                ...prev,
                tracks: [
                  ...prev.tracks,
                  ...savedTracks(page, prev.tracks.length),
                ],
                next: page.next,
              },
          );
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [next, nearEnd, searching]);

  if (failed)
    return (
      <p className="notice-error" role="alert">
        Couldn't load your Liked Songs.
      </p>
    );
  if (!list) return <SkeletonRows />;

  const tracks = list.tracks.filter((t) => matches(query, t.name, t.artists));
  return (
    <>
      {tracks.length === 0 && !next ? (
        <p className="notice-detail">
          {searching
            ? `No liked songs match “${query}”.`
            : "No liked songs yet."}
        </p>
      ) : (
        <ul className="recents compact">
          {tracks.map((track) => {
            const current =
              nowPlaying?.contextUri === uri &&
              nowPlaying.trackUri === track.uri;
            return (
              <CoverRow
                key={track.key}
                name={track.name}
                label={track.artists}
                imageUrl={track.imageUrl}
                current={current}
                playing={current && !nowPlaying.paused}
                trailing={formatDuration(track.durationMs)}
                onOpen={() => play(uri, track.uri)}
                onPlay={() => (current ? togglePlay() : play(uri, track.uri))}
              />
            );
          })}
        </ul>
      )}
      {next && <div ref={sentinel} className="sentinel" />}
    </>
  );
}

function NewPlaylist({ onCreated }: { onCreated: (uri: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const name = nameInput.current?.value.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const res = await spotifyFetch("/me/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, public: false }),
      });
      if (res.status === 403)
        return setError("Spotify doesn't let Oscilla create playlists yet.");
      if (!res.ok) return setError("Couldn't create the playlist. Try again.");
      const { uri }: { uri: string } = await res.json();
      form.reset();
      form.hidePopover();
      onCreated(uri);
    } catch {
      setError("Couldn't create the playlist. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        className="icon-button new-playlist"
        popoverTarget="new-playlist"
        aria-label="New playlist"
      >
        <PlusIcon />
      </button>
      <form
        id="new-playlist"
        className="account-menu new-playlist-menu"
        popover="auto"
        onSubmit={create}
        onToggle={(event) => {
          if (event.newState === "open") nameInput.current?.focus();
        }}
      >
        <label htmlFor="playlist-name" className="eyebrow">
          New playlist
        </label>
        <div className="new-playlist-row">
          <input
            id="playlist-name"
            ref={nameInput}
            className="text-input"
            placeholder="Name"
            autoComplete="off"
            required
          />
          <button className="create-button" disabled={busy}>
            Create
          </button>
        </div>
        {error && (
          <p className="notice-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </>
  );
}

export function LibraryPage({
  listener,
  hidden,
  onOpen,
}: {
  listener: Listener;
  hidden: boolean;
  onOpen: (uri: string) => void;
}) {
  const { state, retry, refresh } = useFocusedLoad(
    () => loadLibrary(listener),
    listener,
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (hidden) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hidden]);

  const items =
    state.status === "ready"
      ? state.value.filter(
          (item) =>
            (filter === "all" || item.kind === filter) &&
            matches(query, item.name, item.by),
        )
      : [];

  return (
    <section
      className="home-column library"
      aria-labelledby="library-heading"
      hidden={hidden}
    >
      <div className="library-head">
        <h1 id="library-heading" className="home-heading">
          Library
        </h1>
        <NewPlaylist
          onCreated={(uri) => {
            refresh();
            onOpen(uri);
          }}
        />
      </div>
      <label className="search-field">
        <SearchIcon />
        <input
          ref={search}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search your Library"
          aria-label="Search your Library"
        />
        <kbd>Ctrl F</kbd>
      </label>
      <div className="chips" role="group" aria-label="Show">
        {FILTERS.map(([value, label]) => (
          <button
            key={value}
            className="chip"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div aria-live="polite" aria-busy={state.status === "loading"}>
        {filter === "likedSongs" ? (
          <LikedSongs listener={listener} query={query} />
        ) : state.status === "loading" ? (
          <SkeletonRows />
        ) : state.status === "error" ? (
          <div className="notice" role="alert">
            <p className="notice-error">Couldn't load your Library.</p>
            <p className="notice-detail">
              Check your connection, then try again.
            </p>
            <button className="ghost-button" onClick={retry}>
              Retry
            </button>
          </div>
        ) : (
          <Items items={items} query={query.trim()} onOpen={onOpen} />
        )}
      </div>
    </section>
  );
}
