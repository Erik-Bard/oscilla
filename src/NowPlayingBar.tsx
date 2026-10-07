import { useEffect, useRef, useState, type CSSProperties } from "react";
import { PauseIcon, PlayIcon, ShuffleIcon } from "./icons";
import { usePlayer, type NowPlaying } from "./player";
import { formatDuration } from "./tracklist";

function currentPosition(nowPlaying: NowPlaying, now: number) {
  if (nowPlaying.paused) return nowPlaying.positionMs;
  return Math.min(
    nowPlaying.positionMs + Math.max(0, now - nowPlaying.reportedAt),
    nowPlaying.durationMs,
  );
}

function useAnimationClock(running: boolean) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!running) return;
    let frame = requestAnimationFrame(function tick(time) {
      setNow(time);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [running]);
  return now;
}

function VolumeIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M3 9h4l5-4v14l-5-4H3z" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        d={
          muted
            ? "M16 9l5 6M21 9l-5 6"
            : "M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"
        }
      />
    </svg>
  );
}

export function NowPlayingBar() {
  const player = usePlayer();
  const { nowPlaying, error, volume } = player;
  const [dragMs, setDragMs] = useState<number | null>(null);
  const volumeBeforeMute = useRef(volume);
  const now = useAnimationClock(!!nowPlaying && !nowPlaying.paused);

  const errorLine = error && (
    <p className="player-error" role="alert">
      {error}
    </p>
  );
  if (!nowPlaying) return errorLine;

  const positionMs = dragMs ?? currentPosition(nowPlaying, now);
  const progress = nowPlaying.durationMs
    ? (positionMs / nowPlaying.durationMs) * 100
    : 0;
  const commitSeek = () => {
    if (dragMs === null) return;
    player.seek(dragMs);
    setDragMs(null);
  };
  const toggleMute = () => {
    if (volume > 0) {
      volumeBeforeMute.current = volume;
      player.setVolume(0);
    } else {
      player.setVolume(volumeBeforeMute.current || 0.7);
    }
  };

  return (
    <>
      {errorLine}
      <footer className="player" aria-label="Now Playing">
        <div className="np">
          {nowPlaying.imageUrl ? (
            <img className="cover np-cover" src={nowPlaying.imageUrl} alt="" />
          ) : (
            <span className="cover np-cover" />
          )}
          <div className="np-text">
            <p className="np-title">{nowPlaying.name}</p>
            <p className="np-sub">{nowPlaying.artists}</p>
          </div>
        </div>
        <div className="transport">
          <div className="transport-buttons">
            <button
              className="icon-button toggle"
              aria-label="Shuffle"
              aria-pressed={player.shuffle}
              onClick={player.toggleShuffle}
            >
              <ShuffleIcon />
            </button>
            <button
              className="icon-button"
              aria-label="Previous"
              onClick={player.previous}
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                aria-hidden="true"
              >
                <path fill="currentColor" d="M6 5h2v14H6zM20 5v14L9 12z" />
              </svg>
            </button>
            <button
              className="icon-button play-button"
              aria-label={nowPlaying.paused ? "Play" : "Pause"}
              onClick={player.togglePlay}
            >
              {nowPlaying.paused ? <PlayIcon /> : <PauseIcon />}
            </button>
            <button
              className="icon-button"
              aria-label="Next"
              onClick={player.next}
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                aria-hidden="true"
              >
                <path fill="currentColor" d="M16 5h2v14h-2zM4 5v14l11-7z" />
              </svg>
            </button>
            <span className="transport-spacer" aria-hidden="true" />
          </div>
          <div className="timeline">
            <span>{formatDuration(positionMs)}</span>
            <input
              className={`slider seek${nowPlaying.paused ? "" : " is-playing"}`}
              type="range"
              min={0}
              max={nowPlaying.durationMs}
              step={1000}
              value={positionMs}
              aria-label="Seek"
              aria-valuetext={`${formatDuration(positionMs)} of ${formatDuration(nowPlaying.durationMs)}`}
              style={{ "--p": `${progress}%` } as CSSProperties}
              onChange={(e) => setDragMs(Number(e.target.value))}
              onPointerUp={commitSeek}
              onKeyUp={commitSeek}
              onBlur={commitSeek}
            />
            <span>{formatDuration(nowPlaying.durationMs)}</span>
          </div>
        </div>
        <div className="volume">
          <button
            className="icon-button"
            aria-label={volume > 0 ? "Mute" : "Unmute"}
            onClick={toggleMute}
          >
            <VolumeIcon muted={volume === 0} />
          </button>
          <input
            className="slider"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            aria-label="Volume"
            style={{ "--p": `${volume * 100}%` } as CSSProperties}
            onChange={(e) => player.setVolume(Number(e.target.value))}
          />
        </div>
      </footer>
    </>
  );
}
