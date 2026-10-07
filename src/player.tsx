import { invoke } from "@tauri-apps/api/core";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { coverUrl, type SpotifyImage } from "./recents";
import { spotifyFetch } from "./spotify";

type SdkState = {
  paused: boolean;
  shuffle: boolean;
  position: number;
  duration: number;
  context: { uri: string | null };
  track_window: {
    current_track: {
      uri: string;
      name: string;
      album: { images: SpotifyImage[] };
      artists: { name: string }[];
    };
  };
};

type SdkError = { message: string };

type SdkPlayer = {
  connect(): Promise<boolean>;
  disconnect(): void;
  activateElement(): Promise<void>;
  addListener(
    event: "ready" | "not_ready",
    callback: (device: { device_id: string }) => void,
  ): void;
  addListener(
    event: "player_state_changed",
    callback: (state: SdkState | null) => void,
  ): void;
  addListener(
    event:
      | "initialization_error"
      | "authentication_error"
      | "account_error"
      | "playback_error",
    callback: (error: SdkError) => void,
  ): void;
  togglePlay(): Promise<void>;
  previousTrack(): Promise<void>;
  nextTrack(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
};

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: {
      Player: new (options: {
        name: string;
        getOAuthToken: (callback: (token: string) => void) => void;
        volume: number;
      }) => SdkPlayer;
    };
  }
}

let sdk: Promise<void> | undefined;

function loadSdk() {
  sdk ??= new Promise((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = resolve;
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.onerror = () => {
      sdk = undefined;
      reject(new Error("sdk"));
    };
    document.head.append(script);
  });
  return sdk;
}

export type NowPlaying = {
  contextUri: string | null;
  trackUri: string;
  name: string;
  artists: string;
  imageUrl: string | null;
  paused: boolean;
  durationMs: number;
  positionMs: number;
  reportedAt: number;
};

type Player = {
  nowPlaying: NowPlaying | null;
  error: string | null;
  volume: number;
  shuffle: boolean;
  toggleShuffle: () => void;
  play: (contextUri: string, trackUri?: string) => void;
  togglePlay: () => void;
  previous: () => void;
  next: () => void;
  seek: (positionMs: number) => void;
  setVolume: (volume: number) => void;
};

const PlayerContext = createContext<Player | null>(null);

const INITIAL_VOLUME = 0.7;
const PLAYBACK_FAILED = "Couldn't start playback. Try again.";

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    target.closest("input, textarea, select, button, [contenteditable]") !==
      null
  );
}

async function trackCount(contextUri: string) {
  const [, type, id] = contextUri.split(":");
  const path = contextUri.endsWith(":collection")
    ? "/me/tracks?limit=1"
    : type === "album"
      ? `/albums/${id}/tracks?limit=1`
      : `/playlists/${id}/tracks?limit=1&fields=total`;
  const res = await spotifyFetch(path);
  if (!res.ok) return null;
  const { total }: { total: number } = await res.json();
  return total;
}

function toNowPlaying(state: SdkState): NowPlaying {
  const track = state.track_window.current_track;
  return {
    contextUri: state.context.uri,
    trackUri: track.uri,
    name: track.name,
    artists: track.artists.map((a) => a.name).join(", "),
    imageUrl: coverUrl(track.album.images),
    paused: state.paused,
    durationMs: state.duration,
    positionMs: state.position,
    reportedAt: performance.now(),
  };
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolumeState] = useState(INITIAL_VOLUME);
  const [shuffle, setShuffle] = useState(false);
  const player = useRef<SdkPlayer | null>(null);
  const deviceId = useRef<string | null>(null);

  useEffect(() => {
    let disconnected = false;
    let created: SdkPlayer | undefined;
    loadSdk().then(
      () => {
        if (disconnected || !window.Spotify) return;
        created = new window.Spotify.Player({
          name: "Oscilla",
          getOAuthToken: (callback) =>
            void invoke<string>("access_token", { forceRefresh: false }).then(
              callback,
            ),
          volume: INITIAL_VOLUME,
        });
        created.addListener("ready", ({ device_id }) => {
          deviceId.current = device_id;
        });
        created.addListener("not_ready", () => {
          deviceId.current = null;
        });
        created.addListener("player_state_changed", (state) => {
          setNowPlaying(state && toNowPlaying(state));
          if (state) setShuffle(state.shuffle);
        });
        const fail = () => setError(PLAYBACK_FAILED);
        created.addListener("initialization_error", fail);
        created.addListener("authentication_error", fail);
        created.addListener("account_error", fail);
        created.addListener("playback_error", fail);
        void created.connect();
        player.current = created;
      },
      () => setError("Couldn't load Spotify's player. Check your connection."),
    );
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" || isTyping(event.target) || !player.current)
        return;
      event.preventDefault();
      void player.current.togglePlay();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      disconnected = true;
      created?.disconnect();
      player.current = null;
      deviceId.current = null;
    };
  }, []);

  const sendShuffle = (state: boolean) =>
    spotifyFetch(
      `/me/player/shuffle?state=${state}&device_id=${deviceId.current}`,
      { method: "PUT" },
    );

  const play = (contextUri: string, trackUri?: string) => {
    if (!player.current || !deviceId.current) {
      setError(
        "Oscilla is still connecting to Spotify. Try again in a moment.",
      );
      return;
    }
    void player.current.activateElement();
    setError(null);
    void (async () => {
      let offset: object | undefined = trackUri ? { uri: trackUri } : undefined;
      if (!offset && shuffle) {
        const total = await trackCount(contextUri);
        if (total) offset = { position: Math.floor(Math.random() * total) };
      }
      const res = await spotifyFetch(
        `/me/player/play?device_id=${deviceId.current}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ context_uri: contextUri, offset }),
        },
      );
      if (!res.ok) return setError(PLAYBACK_FAILED);
      await sendShuffle(shuffle);
    })().catch(() => setError(PLAYBACK_FAILED));
  };

  const toggleShuffle = () => {
    setShuffle(!shuffle);
    if (nowPlaying && deviceId.current) void sendShuffle(!shuffle);
  };

  const seek = (positionMs: number) => {
    setNowPlaying(
      (prev) => prev && { ...prev, positionMs, reportedAt: performance.now() },
    );
    void player.current?.seek(positionMs);
  };

  const setVolume = (next: number) => {
    setVolumeState(next);
    void player.current?.setVolume(next);
  };

  const value: Player = {
    nowPlaying,
    error,
    volume,
    shuffle,
    toggleShuffle,
    play,
    togglePlay: () => void player.current?.togglePlay(),
    previous: () => void player.current?.previousTrack(),
    next: () => void player.current?.nextTrack(),
    seek,
    setVolume,
  };

  return <PlayerContext value={value}>{children}</PlayerContext>;
}

export function usePlayer() {
  const player = useContext(PlayerContext);
  if (!player) throw new Error("usePlayer must be used inside PlayerProvider");
  return player;
}
