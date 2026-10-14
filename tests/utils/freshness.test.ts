import assert from "node:assert/strict";
import {
  ALBUM_CURRENT_FOR_MS,
  isOlderThan,
  RECHECK_TRACKLIST_AFTER_MS,
  reconciled,
  RELOAD_ON_FOCUS_AFTER_MS,
  throttlePauseMs,
  tracklistChanged,
  tracklistIsCurrent,
} from "../../src/utils/freshness.ts";
import type { Track, Tracklist } from "../../src/types/tracklist.ts";

const NOW = 1_800_000_000_000;

const track = (uri: string, addedAt: string | null = null): Track => ({
  key: uri,
  uri,
  name: uri,
  artists: [],
  album: null,
  imageUrl: null,
  addedAt,
  durationMs: 1000,
  playable: true,
});

const tracklist = (overrides: Partial<Tracklist>): Tracklist => ({
  kind: "playlist",
  typeLabel: "Playlist",
  name: "Mix",
  owner: "Erik",
  ownerId: "erik",
  year: null,
  imageUrl: null,
  total: 1,
  tracks: [track("a")],
  next: null,
  ...overrides,
});

assert.equal(isOlderThan(NOW - 10, 5, NOW), true);
assert.equal(isOlderThan(NOW - 5, 5, NOW), false);
assert.equal(isOlderThan(0, RELOAD_ON_FOCUS_AFTER_MS, NOW), true);
assert.equal(
  isOlderThan(NOW - 60_000, RELOAD_ON_FOCUS_AFTER_MS, NOW),
  false,
  "a focus one minute after the last load does not reload",
);

const album = tracklist({ kind: "album", fetchedAt: NOW - 1000 });
assert.equal(tracklistIsCurrent(album, NOW), true);
assert.equal(
  tracklistIsCurrent(
    { ...album, fetchedAt: NOW - ALBUM_CURRENT_FOR_MS - 1 },
    NOW,
  ),
  false,
);
assert.equal(
  tracklistIsCurrent({ ...album, fetchedAt: undefined }, NOW),
  false,
);
assert.equal(
  tracklistIsCurrent(tracklist({ fetchedAt: NOW - 60_000 }), NOW),
  true,
  "a playlist reopened a minute later is not checked again",
);
assert.equal(
  tracklistIsCurrent(
    tracklist({ fetchedAt: NOW - RECHECK_TRACKLIST_AFTER_MS - 1 }),
    NOW,
  ),
  false,
);

assert.equal(
  tracklistChanged(
    tracklist({ snapshotId: "1" }),
    tracklist({ snapshotId: "1" }),
  ),
  false,
);
assert.equal(
  tracklistChanged(
    tracklist({ snapshotId: "1" }),
    tracklist({ snapshotId: "2" }),
  ),
  true,
);

const liked = (total: number, newest: Track) =>
  tracklist({ kind: "likedSongs", total, tracks: [newest] });
assert.equal(
  tracklistChanged(liked(3, track("a", "mon")), liked(3, track("a", "mon"))),
  false,
);
assert.equal(
  tracklistChanged(liked(3, track("a", "mon")), liked(2, track("a", "mon"))),
  true,
  "an older liked song was removed",
);
assert.equal(
  tracklistChanged(liked(3, track("a", "mon")), liked(3, track("b", "tue"))),
  true,
  "one liked song was swapped for a newer one",
);
assert.equal(tracklistChanged(album, album), true);

const scrolledThrough = tracklist({
  snapshotId: "1",
  name: "Old name",
  tracks: [track("a"), track("b")],
  next: "page-3",
});
const firstPageAgain = tracklist({
  snapshotId: "1",
  name: "New name",
  next: "page-2",
});
const unchanged = reconciled(scrolledThrough, firstPageAgain);
assert.equal(unchanged.name, "New name");
assert.equal(unchanged.tracks.length, 2);
assert.equal(unchanged.next, "page-3");

const edited = { ...firstPageAgain, snapshotId: "2" };
assert.equal(reconciled(scrolledThrough, edited), edited);
assert.equal(reconciled(undefined, edited), edited);

assert.equal(throttlePauseMs("2112", 0), 2_112_000);
assert.equal(throttlePauseMs(null, 0), 5000);
assert.equal(throttlePauseMs("0", 1), 20_000);
assert.equal(throttlePauseMs("soon", 2), 80_000);
assert.equal(throttlePauseMs(null, 9), 15 * 60 * 1000);

console.log("freshness: ok");
