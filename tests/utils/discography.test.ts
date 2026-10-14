import assert from "node:assert/strict";
import {
  pageCount,
  pageOf,
  pageSizeFor,
  requestsFor,
} from "../../src/utils/discography.ts";

const tile = { minWidth: 160, textHeight: 50, gap: 20 };

assert.equal(pageSizeFor(880, 600, tile), 10);
assert.equal(pageSizeFor(100, 100, tile), 1);

assert.equal(pageCount(0, 10), 1);
assert.equal(pageCount(23, 10), 3);

assert.deepEqual(requestsFor(1, 12), [
  { offset: 12, limit: 10 },
  { offset: 22, limit: 2 },
]);
assert.deepEqual(requestsFor(0, 10), [{ offset: 0, limit: 10 }]);

assert.equal(pageOf(24, 12), 2);
assert.equal(pageOf(24, 8), 3);

console.log("discography: ok");
