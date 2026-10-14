import assert from "node:assert/strict";
import {
  formatTotal,
  fromPlaylist,
  popularTracks,
} from "../../src/utils/tracklist.ts";

const track = (uri: string, extra = {}) => ({
  uri,
  name: uri,
  duration_ms: 1000,
  artists: [{ name: "Artist", uri: "spotify:artist:x" }],
  album: { name: "Album", images: [] },
  ...extra,
});

const list = fromPlaylist({
  name: "Airplane Waves",
  public: true,
  images: [],
  owner: { id: "erik", display_name: "Erik Bard" },
  items: {
    total: 5,
    next: null,
    items: [
      { added_at: "2025-08-12T00:00:00Z", track: track("spotify:track:a") },
      { added_at: "2025-08-12T00:00:00Z", track: null },
      {
        added_at: null,
        is_local: true,
        track: track("spotify:local:b", {
          artists: [{ name: "Artist", uri: null }],
        }),
      },
      {
        added_at: null,
        item: track("spotify:episode:c", {
          artists: undefined,
          show: { name: "Show" },
        }),
      },
      {
        added_at: null,
        track: track("spotify:track:d", { is_playable: false }),
      },
    ],
  },
});

assert.equal(list.typeLabel, "Public Playlist");
assert.deepEqual(
  list.tracks.map((t) => [t.uri, t.artists, t.playable]),
  [
    ["spotify:track:a", [{ name: "Artist", uri: "spotify:artist:x" }], true],
    ["spotify:local:b", [{ name: "Artist", uri: null }], false],
    ["spotify:episode:c", [{ name: "Show", uri: null }], true],
    ["spotify:track:d", [{ name: "Artist", uri: "spotify:artist:x" }], false],
  ],
);
assert.equal(new Set(list.tracks.map((t) => t.key)).size, 4);

assert.equal(formatTotal(41 * 60_000 + 12_000), "41 min 12 sec");
assert.equal(formatTotal(255 * 60_000), "about 4 hr 15 min");

console.log("tracklist: ok");

const followed = fromPlaylist({
  name: "Someone else's mix",
  public: true,
  images: null,
  owner: { id: "friend", display_name: "Friend" },
});
assert.equal(followed.tracksHidden, true);
assert.equal(list.tracksHidden, false);

const searchHit = (name: string, artistUri: string) => ({
  uri: `spotify:track:${name}`,
  name,
  duration_ms: 1000,
  artists: [{ name: "x", uri: artistUri }],
});
const ffdp = "spotify:artist:ffdp";
assert.deepEqual(
  popularTracks(
    [
      {
        total: 5,
        next: null,
        items: [
          searchHit("Wrong Side of Heaven", ffdp),
          searchHit("Lookalike", "spotify:artist:other"),
          searchHit("wrong side of heaven", ffdp),
        ],
      },
      {
        total: 5,
        next: null,
        items: [searchHit("Lift Me Up", ffdp), searchHit("Jekyll", ffdp)],
      },
    ],
    ffdp,
    2,
  ).map((t) => t.name),
  ["Wrong Side of Heaven", "Lift Me Up"],
);

console.log("popular: ok");
