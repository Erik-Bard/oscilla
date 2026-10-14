import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import {
  ClockIcon,
  Equalizer,
  HeartIcon,
  PauseIcon,
  PlayIcon,
  RefreshIcon,
} from "../components/icons";
import { ArtistLinks } from "../components/ArtistLinks";
import { usePlayer } from "../context/player";
import { useCoverTint, useHeroTitle } from "../hooks/hero";
import {
  isUnavailable,
  loadMore,
  openTracklist,
  refreshTracklist,
  rememberTracklist,
} from "../utils/loadTracklist";
import { formatDuration, formatTotal } from "../utils/tracklist";
import type { Tracklist } from "../types/tracklist";
import type { Listener } from "../types/session";

type PageState =
  | { status: "loading" }
  | { status: "error"; unavailable: boolean }
  | { status: "ready"; list: Tracklist };

const dateAdded = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function TracklistPage({
  uri,
  listener,
  onOpen,
  onHeroTitleHidden,
}: {
  uri: string;
  listener: Listener;
  onOpen: (uri: string) => void;
  onHeroTitleHidden: (name: string | null) => void;
}) {
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [checking, setChecking] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState(0);
  const loadingMore = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const rows = useRef<(HTMLDivElement | null)[]>([]);
  const player = usePlayer();
  const list = state.status === "ready" ? state.list : null;
  const tint = useCoverTint(list?.imageUrl ?? null);
  const heroTitle = useHeroTitle(list?.name, onHeroTitleHidden);
  const ownedByListener =
    list?.kind === "likedSongs" || list?.ownerId === listener.id;
  const ownerImage = ownedByListener ? listener.imageUrl : null;

  useEffect(() => {
    let cancelled = false;
    openTracklist(uri, listener, (opened) => {
      if (!cancelled) setState({ status: "ready", list: opened });
    })
      .catch((error: unknown) => {
        if (!cancelled)
          setState({ status: "error", unavailable: isUnavailable(error) });
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uri, listener, attempt]);

  useEffect(() => {
    if (list) rememberTracklist(uri, list);
  }, [uri, list]);

  const refresh = () => {
    setRefreshing(true);
    refreshTracklist(uri, listener)
      .then(
        (fresh) => setState({ status: "ready", list: fresh }),
        () => {},
      )
      .finally(() => setRefreshing(false));
  };

  useEffect(() => {
    if (checking || refreshing || !list?.next || !sentinel.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || loadingMore.current) return;
      loadingMore.current = true;
      loadMore(list)
        .then((more) => setState({ status: "ready", list: more }))
        .catch(() => {})
        .finally(() => (loadingMore.current = false));
    });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [list, checking, refreshing]);

  if (state.status === "error")
    return (
      <div className="page-column">
        <div className="notice" role="alert">
          <p className="notice-error">
            {state.unavailable
              ? "Oscilla can't open this one. Spotify doesn't share it with third-party apps."
              : "Couldn't load this page."}
          </p>
          {!state.unavailable && (
            <button
              className="ghost-button"
              onClick={() => {
                setState({ status: "loading" });
                setChecking(true);
                setAttempt(attempt + 1);
              }}
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );

  if (!list)
    return (
      <div className="tracklist-page" aria-busy="true">
        <div className="page-column">
          <div className="hero">
            <span className="hero-cover skeleton-block" />
            <div className="hero-info">
              <span className="bar" style={{ width: 120 }} />
              <span className="bar hero-title-bar" />
              <span className="bar" style={{ width: 200 }} />
            </div>
          </div>
        </div>
      </div>
    );

  const isAlbum = list.kind === "album";
  const isCurrent = player.nowPlaying?.contextUri === uri;
  const isPlaying = isCurrent && !player.nowPlaying?.paused;
  const allLoaded = list.tracks.length >= list.total;
  const totalMs = list.tracks.reduce((sum, t) => sum + t.durationMs, 0);
  const songs = `${list.total} ${list.total === 1 ? "song" : "songs"}`;

  const playTrack = (index: number) => {
    const track = list.tracks[index];
    if (track?.playable) player.play(uri, track.uri);
  };

  const onRowKey = (event: KeyboardEvent, index: number) => {
    const step =
      event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (event.key === "Enter") return playTrack(index);
    if (!step) return;
    event.preventDefault();
    const target = Math.min(Math.max(index + step, 0), list.tracks.length - 1);
    setSelected(target);
    rows.current[target]?.focus();
  };

  return (
    <div className="tracklist-page" style={{ "--tint": tint } as CSSProperties}>
      <div className="page-column">
        <div className="hero">
          {list.kind === "likedSongs" ? (
            <span className="hero-cover liked-cover">
              <HeartIcon size={72} />
            </span>
          ) : list.imageUrl ? (
            <img className="hero-cover" src={list.imageUrl} alt="" />
          ) : (
            <span className="hero-cover" />
          )}
          <div className="hero-info">
            <p className="hero-type">{list.typeLabel}</p>
            <h1 className="hero-title" ref={heroTitle}>
              {list.name}
            </h1>
            <p className="hero-meta">
              <span className="hero-owner">
                {ownerImage && (
                  <img className="owner-avatar" src={ownerImage} alt="" />
                )}
                {list.artists ? (
                  <ArtistLinks artists={list.artists} onOpen={onOpen} />
                ) : (
                  list.owner
                )}
              </span>
              {list.year && <span>· {list.year}</span>}
              {!list.tracksHidden && (
                <span>
                  · {songs}
                  {allLoaded && `, ${formatTotal(totalMs)}`}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="page-actions">
          <button
            className="icon-button big-play"
            aria-label={`${isPlaying ? "Pause" : "Play"} ${list.name}`}
            onClick={() => (isCurrent ? player.togglePlay() : player.play(uri))}
          >
            {isPlaying ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
          </button>
          {!isAlbum && (
            <button
              className={`icon-button refresh-button${refreshing ? " refreshing" : ""}`}
              aria-label={`Refresh ${list.name}`}
              aria-busy={refreshing}
              title="Refresh"
              disabled={refreshing}
              onClick={refresh}
            >
              <RefreshIcon />
            </button>
          )}
        </div>
        {list.tracksHidden ? (
          <p className="notice">
            Spotify only shares the songs of playlists you own or collaborate
            on. You can still play this one.
          </p>
        ) : (
          <div
            role="grid"
            aria-label={`${list.name} tracks`}
            aria-rowcount={list.total + 1}
            className={`tracks${isAlbum ? " album" : ""}`}
          >
            <div className="tracks-head" role="row">
              <span role="columnheader" className="col-num">
                #
              </span>
              <span role="columnheader">Title</span>
              {!isAlbum && (
                <>
                  <span role="columnheader" className="col-album">
                    Album
                  </span>
                  <span role="columnheader" className="col-added">
                    Date added
                  </span>
                </>
              )}
              <span
                role="columnheader"
                className="col-dur"
                aria-label="Duration"
              >
                <ClockIcon />
              </span>
            </div>
            {list.tracks.map((track, index) => {
              const playing =
                isCurrent && player.nowPlaying?.trackUri === track.uri;
              const classes = [
                "row",
                playing && "playing",
                playing && player.nowPlaying?.paused && "is-paused",
                !track.playable && "unavailable",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <div
                  key={track.key}
                  ref={(el) => {
                    rows.current[index] = el;
                  }}
                  className={classes}
                  role="row"
                  aria-rowindex={index + 2}
                  aria-selected={selected === index}
                  aria-disabled={!track.playable || undefined}
                  title={track.playable ? undefined : "Not available"}
                  tabIndex={selected === index ? 0 : -1}
                  onClick={() => setSelected(index)}
                  onDoubleClick={() => playTrack(index)}
                  onKeyDown={(e) => onRowKey(e, index)}
                >
                  <span className="col-num" role="gridcell">
                    <span className="row-number">
                      {playing ? <Equalizer label="Playing" /> : index + 1}
                    </span>
                    {track.playable && (
                      <button
                        className="icon-button row-play"
                        tabIndex={-1}
                        aria-label={`Play ${track.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          playTrack(index);
                        }}
                      >
                        <PlayIcon size={16} />
                      </button>
                    )}
                  </span>
                  <span className="track-title" role="gridcell">
                    {!isAlbum &&
                      (track.imageUrl ? (
                        <img
                          className="thumb"
                          src={track.imageUrl}
                          alt=""
                          width={40}
                          height={40}
                          loading="lazy"
                        />
                      ) : (
                        <span className="thumb" />
                      ))}
                    <span className="track-text">
                      <span className="track-name">{track.name}</span>
                      <span className="track-sub">
                        <ArtistLinks artists={track.artists} onOpen={onOpen} />
                      </span>
                    </span>
                  </span>
                  {!isAlbum && (
                    <>
                      <span className="col-album track-sub" role="gridcell">
                        {track.album}
                      </span>
                      <span className="col-added track-sub" role="gridcell">
                        {track.addedAt &&
                          dateAdded.format(new Date(track.addedAt))}
                      </span>
                    </>
                  )}
                  <span className="col-dur track-sub" role="gridcell">
                    {formatDuration(track.durationMs)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {list.next && <div ref={sentinel} className="sentinel" />}
      </div>
    </div>
  );
}
