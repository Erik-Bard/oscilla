import type { Play, SpotifyImage } from "../types/spotify.ts";
import type { Candidate } from "../types/recents.ts";

export function candidates(plays: Play[]): Candidate[] {
  const seen = new Set<string>();
  const result: Candidate[] = [];
  for (const { context, played_at: playedAt, track } of plays) {
    if (!context || seen.has(context.uri)) continue;
    seen.add(context.uri);
    const played = { uri: context.uri, playedAt };
    if (context.type === "album") {
      result.push({ ...played, kind: "album", album: track.album });
    } else if (context.type === "playlist") {
      result.push({ ...played, kind: "playlist" });
    } else if (
      context.type === "collection" ||
      context.uri.endsWith(":collection")
    ) {
      result.push({ ...played, kind: "likedSongs" });
    }
  }
  return result;
}

export function newestFirst(plays: Play[]): Play[] {
  return [...plays].sort(
    (a, b) => Date.parse(b.played_at) - Date.parse(a.played_at),
  );
}

export function albumLabel(albumType: string) {
  if (albumType === "single") return "Single";
  if (albumType === "compilation") return "Compilation";
  return "Album";
}

export function coverUrl(images: SpotifyImage[]) {
  return (
    [...images].reverse().find((image) => (image.width ?? 0) >= 112)?.url ??
    images[0]?.url ??
    null
  );
}

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function playedAgo(playedAt: string, now = Date.now()) {
  const minutes = Math.round((Date.parse(playedAt) - now) / 60_000);
  if (minutes > -1) return "just now";
  if (minutes > -60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours > -24) return relative.format(hours, "hour");
  return relative.format(Math.round(hours / 24), "day");
}
