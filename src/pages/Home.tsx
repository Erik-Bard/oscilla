import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  albumLabel,
  candidates,
  newestFirst,
  coverUrl,
  playedAgo,
} from "../utils/recents";
import {
  BackIcon,
  Equalizer,
  HeartIcon,
  PauseIcon,
  PlayIcon,
  ShuffleIcon,
} from "../components/icons";
import { NowPlayingBar } from "../components/NowPlayingBar";
import { LibraryPage } from "./LibraryPage";
import { TracklistPage } from "./TracklistPage";
import { usePlayer } from "../context/player";
import { spotifyFetch } from "../utils/spotify";
import { useFocusedLoad } from "../hooks/useFocusedLoad";
import type { Play, SpotifyImage } from "../types/spotify";
import type { Candidate } from "../types/recents";
import type { Listener } from "../types/session";

const RECENT_COUNT = 5;

type View = "home" | "library";
type Place = { view: View; uri?: string };

type Recent = {
  uri: string;
  name: string;
  label: string;
  imageUrl: string | null;
  likedSongs: boolean;
  playedAt: string;
};

type Playlist = {
  name: string;
  images: SpotifyImage[] | null;
  collaborative: boolean;
  owner: { id: string; display_name: string | null };
};

async function resolve(
  candidate: Candidate,
  listener: Listener,
): Promise<Recent | null> {
  const base = {
    uri: candidate.uri,
    playedAt: candidate.playedAt,
  };
  switch (candidate.kind) {
    case "album": {
      const { album } = candidate;
      return {
        ...base,
        name: album.name,
        label: `${albumLabel(album.album_type)} · ${album.artists.map((a) => a.name).join(", ")}`,
        imageUrl: coverUrl(album.images),
        likedSongs: false,
      };
    }
    case "likedSongs":
      return {
        ...base,
        name: "Liked Songs",
        label: `Playlist · ${listener.displayName}`,
        imageUrl: null,
        likedSongs: true,
      };
    case "playlist": {
      const id = candidate.uri.split(":").pop();
      const res = await spotifyFetch(
        `/playlists/${id}?fields=name,images,collaborative,owner(id,display_name)`,
      );
      if (res.status === 403 || res.status === 404) return null;
      if (!res.ok) throw new Error(`playlist ${res.status}`);
      const playlist: Playlist = await res.json();
      if (playlist.owner.id !== listener.id && !playlist.collaborative)
        return null;
      return {
        ...base,
        name: playlist.name,
        label: `Playlist · ${playlist.owner.display_name ?? "Spotify"}`,
        imageUrl: coverUrl(playlist.images ?? []),
        likedSongs: false,
      };
    }
  }
}

const STARTED_KEY = "oscilla.started";
const STARTED_LIMIT = 20;

function loadStarted(): Play[] {
  try {
    return JSON.parse(localStorage.getItem(STARTED_KEY) ?? "[]");
  } catch {
    return [];
  }
}

async function rememberCurrentPlay(): Promise<Play[]> {
  const started = loadStarted();
  const res = await spotifyFetch("/me/player/currently-playing");
  if (res.status !== 200) return started;
  const { context, item, timestamp } = await res.json();
  if (!context || !item?.album) return started;
  const { uri, name, album_type, images, artists } = item.album;
  const current: Play = {
    context: { type: context.type, uri: context.uri },
    track: { album: { uri, name, album_type, images, artists } },
    played_at: new Date(timestamp).toISOString(),
  };
  const updated = [
    current,
    ...started.filter((p) => p.context?.uri !== context.uri),
  ].slice(0, STARTED_LIMIT);
  try {
    localStorage.setItem(STARTED_KEY, JSON.stringify(updated));
  } catch {}
  return updated;
}

async function loadRecents(listener: Listener): Promise<Recent[]> {
  const res = await spotifyFetch("/me/player/recently-played?limit=50");
  if (!res.ok) throw new Error(`recently-played ${res.status}`);
  const { items }: { items: Play[] } = await res.json();
  const queue = candidates(
    newestFirst([...(await rememberCurrentPlay()), ...items]),
  );
  const recents: Recent[] = [];
  while (queue.length && recents.length < RECENT_COUNT) {
    const batch = queue.splice(0, RECENT_COUNT - recents.length);
    const resolved = await Promise.all(batch.map((c) => resolve(c, listener)));
    recents.push(...resolved.filter((r) => r !== null));
  }
  return recents;
}

function greeting(hour: number) {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

function SignOutIcon() {
  return (
    <svg viewBox="0 0 256 256" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M120,216a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V40a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H56V208h56A8,8,0,0,1,120,216Zm109.66-93.66-40-40a8,8,0,0,0-11.32,11.32L204.69,120H112a8,8,0,0,0,0,16h92.69l-26.35,26.34a8,8,0,0,0,11.32,11.32l40-40A8,8,0,0,0,229.66,122.34Z"
      />
    </svg>
  );
}

function Avatar({ listener }: { listener: Listener }) {
  return listener.imageUrl ? (
    <img className="avatar" src={listener.imageUrl} alt="" />
  ) : (
    <span className="avatar" aria-hidden="true">
      {listener.displayName.charAt(0).toUpperCase()}
    </span>
  );
}

function RecentList({
  recents,
  onOpen,
}: {
  recents: Recent[];
  onOpen: (uri: string) => void;
}) {
  const { nowPlaying, play, togglePlay } = usePlayer();
  if (recents.length === 0)
    return (
      <div className="notice">
        <p>Nothing played yet</p>
        <p className="notice-detail">
          Play a playlist or album in Spotify and it shows up here.
        </p>
      </div>
    );
  return (
    <ul className="recents">
      {recents.map((recent) => {
        const current = nowPlaying?.contextUri === recent.uri;
        const playing = current && !nowPlaying.paused;
        return (
          <li
            key={recent.uri}
            className={`recent${current ? " current" : ""}${current && nowPlaying.paused ? " is-paused" : ""}`}
          >
            <button
              className="recent-open"
              aria-label={`Open ${recent.name}`}
              onClick={() => onOpen(recent.uri)}
            />
            <button
              className="cover-play"
              aria-label={`${playing ? "Pause" : "Play"} ${recent.name}`}
              onClick={() => (current ? togglePlay() : play(recent.uri))}
            >
              {recent.likedSongs ? (
                <span className="cover liked-cover">
                  <HeartIcon />
                </span>
              ) : recent.imageUrl ? (
                <img className="cover" src={recent.imageUrl} alt="" />
              ) : (
                <span className="cover" />
              )}
              <span className="cover-overlay">
                <span>
                  {playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
                </span>
              </span>
            </button>
            <span className="recent-meta">
              <span className="recent-name">
                {current && <Equalizer />}
                {recent.name}
              </span>
              <span className="recent-label">{recent.label}</span>
            </span>
            <span className="recent-when">{playedAgo(recent.playedAt)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Skeleton() {
  return (
    <ul className="recents skeleton" aria-label="Loading recently played">
      {Array.from({ length: RECENT_COUNT }, (_, i) => (
        <li key={i} className="recent">
          <span className="cover" />
          <span className="recent-meta">
            <span className="bar" style={{ width: `${60 - i * 6}%` }} />
            <span className="bar" style={{ width: "32%" }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Home({
  listener,
  signOut,
}: {
  listener: Listener;
  signOut: () => void;
}) {
  const player = usePlayer();
  const { state, retry } = useFocusedLoad(
    () => loadRecents(listener),
    `${listener.id}|${player.nowPlaying?.contextUri}`,
  );
  const [view, setView] = useState<View>("home");
  const [openUri, setOpenUri] = useState<string | null>(null);
  const [libraryVisited, setLibraryVisited] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const listScroll = useRef(0);
  const firstName = listener.displayName.split(" ")[0];
  if (view === "library" && !libraryVisited) setLibraryVisited(true);

  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const state = event.state as Place | null;
      setView(state?.view ?? "home");
      setOpenUri(state?.uri ?? null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useLayoutEffect(() => {
    if (scroller.current)
      scroller.current.scrollTop = openUri ? 0 : listScroll.current;
  }, [openUri, view]);

  const open = (uri: string) => {
    listScroll.current = scroller.current?.scrollTop ?? 0;
    history.pushState({ view, uri } satisfies Place, "");
    setOpenUri(uri);
  };

  const go = (target: View) => {
    if (target === view && !openUri) return;
    listScroll.current = 0;
    history.pushState({ view: target } satisfies Place, "");
    setView(target);
    setOpenUri(null);
  };

  return (
    <div className="home">
      <header className="topbar">
        {openUri && (
          <button
            className="icon-button back-button"
            aria-label="Back"
            onClick={() => history.back()}
          >
            <BackIcon />
          </button>
        )}
        <span className="topbar-wordmark">oscilla</span>
        <nav className="nav-pills" aria-label="Main">
          {(["home", "library"] as const).map((target) => (
            <button
              key={target}
              className="nav-pill"
              aria-current={view === target ? "page" : undefined}
              onClick={() => go(target)}
            >
              {target === "home" ? "Home" : "Library"}
            </button>
          ))}
        </nav>
        <button
          className="icon-button toggle topbar-shuffle"
          aria-label="Shuffle"
          aria-pressed={player.shuffle}
          title={player.shuffle ? "Shuffle is on" : "Shuffle is off"}
          onClick={player.toggleShuffle}
        >
          <ShuffleIcon size={20} />
        </button>
        <button className="account-button" popoverTarget="account-menu">
          <Avatar listener={listener} />
          <span className="account-name">{listener.displayName}</span>
        </button>
        <div id="account-menu" className="account-menu" popover="auto">
          <button onClick={signOut}>
            <SignOutIcon />
            Sign out
          </button>
        </div>
      </header>
      <div className="home-scroll" ref={scroller}>
        {openUri && (
          <TracklistPage key={openUri} uri={openUri} listener={listener} />
        )}
        <section
          className="home-column"
          aria-labelledby="recents-heading"
          hidden={!!openUri || view !== "home"}
        >
          <div>
            <p className="eyebrow">
              {greeting(new Date().getHours())}, {firstName}
            </p>
            <h1 id="recents-heading" className="home-heading">
              Recently played
            </h1>
          </div>
          <div aria-live="polite" aria-busy={state.status === "loading"}>
            {state.status === "loading" ? (
              <Skeleton />
            ) : state.status === "error" ? (
              <div className="notice" role="alert">
                <p className="notice-error">
                  Couldn't load what you played recently.
                </p>
                <p className="notice-detail">
                  Check your connection, then try again.
                </p>
                <button className="ghost-button" onClick={retry}>
                  Retry
                </button>
              </div>
            ) : (
              <RecentList recents={state.value} onOpen={open} />
            )}
          </div>
        </section>
        {libraryVisited && (
          <LibraryPage
            listener={listener}
            hidden={!!openUri || view !== "library"}
            onOpen={open}
          />
        )}
      </div>
      <NowPlayingBar />
    </div>
  );
}
