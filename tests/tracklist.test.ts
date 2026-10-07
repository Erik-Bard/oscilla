import assert from "node:assert/strict";
import { formatTotal, fromPlaylist } from "../src/tracklist.ts";

const track = (uri: string, extra = {}) => ({
  uri,
  name: uri,
  duration_ms: 1000,
  artists: [{ name: "Artist" }],
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
      { added_at: null, is_local: true, track: track("spotify:local:b") },
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
    ["spotify:track:a", "Artist", true],
    ["spotify:local:b", "Artist", false],
    ["spotify:episode:c", "Show", true],
    ["spotify:track:d", "Artist", false],
  ],
);
assert.equal(new Set(list.tracks.map((t) => t.key)).size, 4);

assert.equal(formatTotal(41 * 60_000 + 12_000), "41 min 12 sec");
assert.equal(formatTotal(255 * 60_000), "about 4 hr 15 min");

console.log("tracklist: ok");
