import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { ArtistLinks } from "../components/ArtistLinks";
import { Equalizer, PauseIcon, PlayIcon } from "../components/icons";
import { usePlayer } from "../context/player";
import { useCoverTint, useHeroTitle } from "../hooks/hero";
import {
  pageCount,
  pageOf,
  pageSizeFor,
  requestsFor,
} from "../utils/discography";
import { isUnavailable } from "../utils/loadTracklist";
import { albumLabel, coverUrl } from "../utils/recents";
import { getJson } from "../utils/spotify";
import { formatDuration, popularTracks } from "../utils/tracklist";
import type {
  ApiArtist,
  ApiArtistAlbum,
  ApiPage,
  ApiTrack,
} from "../types/spotify";
import type { Track } from "../types/tracklist";

const TILE = { minWidth: 168, textHeight: 52, gap: 8 };
const DISCOGRAPHY_HEADING_AND_PAGER_HEIGHT = 136;
const RESIZE_SETTLE_MS = 150;
const POPULAR_COUNT = 10;
const POPULAR_SHOWN_FIRST = 5;
const POPULAR_SEARCH_OFFSETS = [0, 10];

type Artist = { name: string; imageUrl: string | null };

type Album = {
  uri: string;
  name: string;
  label: string;
  imageUrl: string | null;
};

type Shelf = { page: number; pageSize: number; total: number; albums: Album[] };

function toAlbum(album: ApiArtistAlbum): Album {
  return {
    uri: album.uri,
    name: album.name,
    label: `${album.release_date.slice(0, 4)} · ${albumLabel(album.album_type)}`,
    imageUrl: coverUrl(album.images),
  };
}

function usePageSize(grid: RefObject<HTMLElement | null>) {
  const [pageSize, setPageSize] = useState<number | null>(null);
  useLayoutEffect(() => {
    const scroller = grid.current?.closest<HTMLElement>(".home-scroll");
    if (!grid.current || !scroller) return;
    const measure = () =>
      grid.current &&
      setPageSize(
        pageSizeFor(
          grid.current.clientWidth,
          scroller.clientHeight - DISCOGRAPHY_HEADING_AND_PAGER_HEIGHT,
          TILE,
        ),
      );
    measure();
    let settle: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(() => {
      clearTimeout(settle);
      settle = setTimeout(measure, RESIZE_SETTLE_MS);
    });
    observer.observe(scroller);
    return () => {
      clearTimeout(settle);
      observer.disconnect();
    };
  }, [grid]);
  return pageSize;
}

function PopularRow({
  track,
  index,
  onPlay,
  onOpen,
}: {
  track: Track;
  index: number;
  onPlay: () => void;
  onOpen: (uri: string) => void;
}) {
  const { nowPlaying, togglePlay } = usePlayer();
  const current = nowPlaying?.trackUri === track.uri;
  const playing = current && !nowPlaying.paused;
  const playOrToggle = () => {
    if (track.playable) (current ? togglePlay : onPlay)();
  };
  const classes = [
    "row",
    current && "playing",
    current && nowPlaying.paused && "is-paused",
    !track.playable && "unavailable",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <li
      className={classes}
      title={track.playable ? undefined : "Not available"}
      onDoubleClick={playOrToggle}
    >
      <span className="col-num">
        <span className="row-number">
          {current ? <Equalizer label="Playing" /> : index + 1}
        </span>
        {track.playable && (
          <button
            className="icon-button row-play"
            aria-label={`${playing ? "Pause" : "Play"} ${track.name}`}
            onClick={playOrToggle}
          >
            {playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
          </button>
        )}
      </span>
      <span className="track-title">
        {track.imageUrl ? (
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
        )}
        <span className="track-text">
          <span className="track-name">{track.name}</span>
          <span className="track-sub">
            <ArtistLinks artists={track.artists} onOpen={onOpen} />
          </span>
        </span>
      </span>
      <span className="col-dur track-sub">
        {formatDuration(track.durationMs)}
      </span>
    </li>
  );
}

function AlbumTile({
  album,
  onOpen,
}: {
  album: Album;
  onOpen: (uri: string) => void;
}) {
  const { nowPlaying, play, togglePlay } = usePlayer();
  const current = nowPlaying?.contextUri === album.uri;
  const playing = current && !nowPlaying.paused;
  return (
    <li className={`album-tile${current ? " current" : ""}`}>
      <button
        className="album-open"
        aria-label={`Open ${album.name}`}
        onClick={() => onOpen(album.uri)}
      />
      <span className="album-art">
        {album.imageUrl ? (
          <img className="cover" src={album.imageUrl} alt="" loading="lazy" />
        ) : (
          <span className="cover" />
        )}
        <button
          className="icon-button tile-play"
          aria-label={`${playing ? "Pause" : "Play"} ${album.name}`}
          onClick={() => (current ? togglePlay() : play(album.uri))}
        >
          {playing ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
        </button>
      </span>
      <span className="album-name">{album.name}</span>
      <span className="album-label">{album.label}</span>
    </li>
  );
}

export function ArtistPage({
  uri,
  onOpen,
  onHeroTitleHidden,
}: {
  uri: string;
  onOpen: (uri: string) => void;
  onHeroTitleHidden: (name: string | null) => void;
}) {
  const id = uri.split(":").pop();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [failure, setFailure] = useState<"unavailable" | "error" | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [firstIndex, setFirstIndex] = useState(0);
  const [shelf, setShelf] = useState<Shelf | null>(null);
  const [shelfFailed, setShelfFailed] = useState(false);
  const [popular, setPopular] = useState<Track[]>([]);
  const [showAllPopular, setShowAllPopular] = useState(false);
  const grid = useRef<HTMLUListElement>(null);
  const knownTotal = useRef(Infinity);
  const pageSize = usePageSize(grid);
  const player = usePlayer();
  const tint = useCoverTint(artist?.imageUrl ?? null);
  const heroTitle = useHeroTitle(artist?.name, onHeroTitleHidden);
  const page = pageSize ? pageOf(firstIndex, pageSize) : 0;

  useEffect(() => {
    let cancelled = false;
    getJson<ApiArtist>(`/artists/${id}`).then(
      (found) => {
        if (!cancelled)
          setArtist({ name: found.name, imageUrl: coverUrl(found.images) });
      },
      (error: unknown) => {
        if (!cancelled)
          setFailure(isUnavailable(error) ? "unavailable" : "error");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  const artistName = artist?.name;
  useEffect(() => {
    if (!artistName) return;
    let cancelled = false;
    const query = encodeURIComponent(`artist:"${artistName}"`);
    Promise.all(
      POPULAR_SEARCH_OFFSETS.map((offset) =>
        getJson<{ tracks: ApiPage<ApiTrack> }>(
          `/search?q=${query}&type=track&limit=10&offset=${offset}&market=from_token`,
        ),
      ),
    ).then(
      (results) => {
        if (!cancelled)
          setPopular(
            popularTracks(
              results.map((r) => r.tracks),
              uri,
              POPULAR_COUNT,
            ),
          );
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [artistName, uri]);

  useEffect(() => {
    if (!pageSize) return;
    let cancelled = false;
    Promise.all(
      requestsFor(page, pageSize)
        .filter(({ offset }) => offset < knownTotal.current)
        .map(({ offset, limit }) =>
          getJson<ApiPage<ApiArtistAlbum>>(
            `/artists/${id}/albums?include_groups=album,single&market=from_token&offset=${offset}&limit=${limit}`,
          ),
        ),
    ).then(
      (pages) => {
        if (cancelled) return;
        knownTotal.current = pages[0].total;
        setShelfFailed(false);
        setShelf({
          page,
          pageSize,
          total: pages[0].total,
          albums: pages.flatMap((p) => p.items).map(toAlbum),
        });
      },
      () => {
        if (!cancelled) setShelfFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id, page, pageSize, attempt]);

  if (failure)
    return (
      <div className="page-column">
        <div className="notice" role="alert">
          <p className="notice-error">
            {failure === "unavailable"
              ? "Oscilla can't open this artist."
              : "Couldn't load this page."}
          </p>
          {failure === "error" && (
            <button
              className="ghost-button"
              onClick={() => {
                setFailure(null);
                setAttempt(attempt + 1);
              }}
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );

  const isCurrent = player.nowPlaying?.contextUri === uri;
  const isPlaying = isCurrent && !player.nowPlaying?.paused;
  const shown =
    shelf && shelf.page === page && shelf.pageSize === pageSize ? shelf : null;
  const pages = shelf && pageSize ? pageCount(shelf.total, pageSize) : 1;
  const goTo = (target: number) => pageSize && setFirstIndex(target * pageSize);

  return (
    <div
      className="tracklist-page"
      style={{ "--tint": tint } as CSSProperties}
      aria-busy={!artist}
    >
      <div className="page-column">
        <div className="hero">
          {artist?.imageUrl ? (
            <img
              className="hero-cover artist-cover"
              src={artist.imageUrl}
              alt=""
            />
          ) : (
            <span
              className={`hero-cover artist-cover${artist ? "" : " skeleton-block"}`}
            />
          )}
          <div className="hero-info">
            {artist ? (
              <>
                <p className="hero-type">Artist</p>
                <h1 className="hero-title" ref={heroTitle}>
                  {artist.name}
                </h1>
              </>
            ) : (
              <>
                <span className="bar" style={{ width: 120 }} />
                <span className="bar hero-title-bar" />
              </>
            )}
          </div>
        </div>
        <div className="page-actions">
          <button
            className="icon-button big-play"
            aria-label={`${isPlaying ? "Pause" : "Play"} ${artist?.name ?? "artist"}`}
            onClick={() => (isCurrent ? player.togglePlay() : player.play(uri))}
          >
            {isPlaying ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
          </button>
        </div>
        {popular.length > 0 && (
          <section aria-label="Popular" className="popular">
            <ol className="tracks album popular-list">
              {(showAllPopular
                ? popular
                : popular.slice(0, POPULAR_SHOWN_FIRST)
              ).map((track, index) => (
                <PopularRow
                  key={track.key}
                  track={track}
                  index={index}
                  onOpen={onOpen}
                  onPlay={() =>
                    player.playTracks(
                      popular.filter((t) => t.playable).map((t) => t.uri),
                      track.uri,
                    )
                  }
                />
              ))}
            </ol>
            {popular.length > POPULAR_SHOWN_FIRST && (
              <button
                className="see-more"
                aria-expanded={showAllPopular}
                onClick={() => setShowAllPopular(!showAllPopular)}
              >
                {showAllPopular ? "Show less" : "See more"}
              </button>
            )}
          </section>
        )}
        <section aria-labelledby="discography-heading">
          <h2 id="discography-heading" className="section-heading">
            Discography
          </h2>
          {shelfFailed && !shown ? (
            <div className="notice" role="alert">
              <p className="notice-error">Couldn't load the discography.</p>
              <button
                className="ghost-button"
                onClick={() => setAttempt(attempt + 1)}
              >
                Retry
              </button>
            </div>
          ) : shown?.total === 0 ? (
            <p className="notice-detail">No albums or singles.</p>
          ) : null}
          <ul ref={grid} className="album-grid" aria-busy={!shown}>
            {shown
              ? shown.albums.map((album) => (
                  <AlbumTile key={album.uri} album={album} onOpen={onOpen} />
                ))
              : !shelfFailed &&
                Array.from({ length: pageSize ?? 0 }, (_, i) => (
                  <li key={i} className="album-tile">
                    <span className="cover skeleton-block" />
                  </li>
                ))}
          </ul>
          {pages > 1 && (
            <nav className="pager" aria-label="Discography pages">
              <button
                className="ghost-button"
                disabled={page === 0}
                onClick={() => goTo(page - 1)}
              >
                ‹ Prev
              </button>
              <span aria-live="polite">
                Page {page + 1} of {pages}
              </span>
              <button
                className="ghost-button"
                disabled={page >= pages - 1}
                onClick={() => goTo(page + 1)}
              >
                Next ›
              </button>
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
