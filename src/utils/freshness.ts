import type { Tracklist } from "../types/tracklist.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
export const KEEP_UNOPENED_FOR_MS = 30 * DAY_MS;
export const ALBUM_CURRENT_FOR_MS = 30 * DAY_MS;
export const RELOAD_ON_FOCUS_AFTER_MS = 5 * 60 * 1000;
export const RECHECK_TRACKLIST_AFTER_MS = 5 * 60 * 1000;
const FIRST_PAUSE_WHEN_RETRY_AFTER_IS_UNREADABLE_MS = 5000;
const LONGEST_PAUSE_WHEN_RETRY_AFTER_IS_UNREADABLE_MS = 15 * 60 * 1000;
export const LONGEST_THROTTLE_WAITED_OUT_MS = 5000;

export function isOlderThan(timestamp: number, ageMs: number, now: number) {
  return now - timestamp > ageMs;
}

export function tracklistIsCurrent(list: Tracklist, now: number) {
  const currentFor =
    list.kind === "album" ? ALBUM_CURRENT_FOR_MS : RECHECK_TRACKLIST_AFTER_MS;
  return (
    list.fetchedAt !== undefined &&
    !isOlderThan(list.fetchedAt, currentFor, now)
  );
}

export function tracklistChanged(cached: Tracklist, fresh: Tracklist) {
  if (fresh.kind === "playlist") return cached.snapshotId !== fresh.snapshotId;
  if (fresh.kind === "likedSongs") {
    const [was, is] = [cached.tracks[0], fresh.tracks[0]];
    return (
      cached.total !== fresh.total ||
      was?.uri !== is?.uri ||
      was?.addedAt !== is?.addedAt
    );
  }
  return true;
}

export function withFreshHeader(cached: Tracklist, fresh: Tracklist) {
  return { ...fresh, tracks: cached.tracks, next: cached.next };
}

export function reconciled(cached: Tracklist | undefined, fresh: Tracklist) {
  return cached && !tracklistChanged(cached, fresh)
    ? withFreshHeader(cached, fresh)
    : fresh;
}

export function throttlePauseMs(
  retryAfter: string | null,
  throttlesInARow: number,
) {
  const seconds = Number(retryAfter);
  if (retryAfter && seconds > 0) return seconds * 1000;
  return Math.min(
    FIRST_PAUSE_WHEN_RETRY_AFTER_IS_UNREADABLE_MS * 4 ** throttlesInARow,
    LONGEST_PAUSE_WHEN_RETRY_AFTER_IS_UNREADABLE_MS,
  );
}
