import assert from "node:assert/strict";
import { libraryItems, matches } from "../../src/utils/library.ts";

const listener = { id: "erik", displayName: "Erik Bard" };
const playlist = (uri: string, ownerId: string, collaborative = false) => ({
  uri,
  name: uri,
  images: null,
  collaborative,
  owner: { id: ownerId, display_name: ownerId },
});

const items = libraryItems(
  listener,
  [
    playlist("mine", "erik"),
    playlist("followed", "friend"),
    null,
    playlist("shared", "friend", true),
  ],
  [
    {
      album: {
        uri: "blonde",
        name: "Blonde",
        album_type: "album",
        images: [],
        artists: [{ name: "Frank Ocean" }],
      },
    },
  ],
);

assert.deepEqual(
  items.map((i) => i.uri),
  ["spotify:user:erik:collection", "mine", "shared", "blonde"],
);
assert.equal(items[3].by, "Frank Ocean");

assert.ok(matches("", "anything"));
assert.ok(matches("  frank ", "Blonde", "Frank Ocean"));
assert.ok(!matches("radiohead", "Blonde", "Frank Ocean"));

console.log("library: ok");
