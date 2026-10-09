import assert from "node:assert/strict";
import {
  candidates,
  coverUrl,
  newestFirst,
  playedAgo,
} from "../../src/utils/recents.ts";
import type { Play } from "../../src/types/spotify.ts";

function play(
  playedAt: string,
  context: Play["context"],
  albumUri = "spotify:album:a",
): Play {
  return {
    played_at: playedAt,
    context,
    track: {
      album: {
        uri: albumUri,
        name: "A",
        album_type: "album",
        images: [],
        artists: [],
      },
    },
  };
}

const focus = { type: "playlist", uri: "spotify:playlist:focus" };
const blonde = { type: "album", uri: "spotify:album:blonde" };
const liked = { type: "collection", uri: "spotify:user:erik:collection" };
const artist = { type: "artist", uri: "spotify:artist:mudvayne" };

const result = candidates([
  play("2026-10-07T12:00:00Z", focus),
  play("2026-10-07T11:57:00Z", focus),
  play("2026-10-07T11:50:00Z", null),
  play("2026-10-07T11:40:00Z", artist),
  play("2026-10-07T11:30:00Z", blonde, blonde.uri),
  play("2026-10-07T11:20:00Z", liked),
  play("2026-10-06T09:00:00Z", focus),
]);
assert.deepEqual(
  result.map((c) => [c.kind, c.uri, c.playedAt]),
  [
    ["playlist", focus.uri, "2026-10-07T12:00:00Z"],
    ["album", blonde.uri, "2026-10-07T11:30:00Z"],
    ["likedSongs", liked.uri, "2026-10-07T11:20:00Z"],
  ],
);

assert.equal(
  coverUrl([
    { url: "640", width: 640 },
    { url: "300", width: 300 },
    { url: "64", width: 64 },
  ]),
  "300",
);
assert.equal(coverUrl([{ url: "only", width: null }]), "only");
assert.equal(coverUrl([]), null);

const now = Date.parse("2026-10-07T12:00:00Z");
assert.equal(playedAgo("2026-10-07T11:59:50Z", now), "just now");
assert.equal(playedAgo("2026-10-07T11:48:00Z", now), "12 minutes ago");
assert.equal(playedAgo("2026-10-07T10:00:00Z", now), "2 hours ago");
assert.equal(playedAgo("2026-10-06T10:00:00Z", now), "yesterday");
assert.equal(playedAgo("2026-10-04T12:00:00Z", now), "3 days ago");

assert.deepEqual(
  candidates(
    newestFirst([
      play("2026-10-07T12:05:00Z", focus),
      play("2026-10-07T12:03:00Z", liked),
      play("2026-10-07T12:04:00Z", blonde),
      play("2026-10-07T12:01:00Z", focus),
    ]),
  ).map((c) => c.uri),
  [focus.uri, blonde.uri, liked.uri],
);

console.log("recents: ok");
