export const ALBUMS_PER_REQUEST = 10;

export function pageSizeFor(
  width: number,
  height: number,
  tile: { minWidth: number; textHeight: number; gap: number },
) {
  const columns = Math.max(
    1,
    Math.floor((width + tile.gap) / (tile.minWidth + tile.gap)),
  );
  const tileWidth = (width - tile.gap * (columns - 1)) / columns;
  const rows = Math.max(
    1,
    Math.floor((height + tile.gap) / (tileWidth + tile.textHeight + tile.gap)),
  );
  return columns * rows;
}

export function pageOf(firstIndex: number, pageSize: number) {
  return Math.floor(firstIndex / pageSize);
}

export function pageCount(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function requestsFor(page: number, pageSize: number) {
  const start = page * pageSize;
  return Array.from(
    { length: Math.ceil(pageSize / ALBUMS_PER_REQUEST) },
    (_, i) => ({
      offset: start + i * ALBUMS_PER_REQUEST,
      limit: Math.min(ALBUMS_PER_REQUEST, pageSize - i * ALBUMS_PER_REQUEST),
    }),
  );
}
