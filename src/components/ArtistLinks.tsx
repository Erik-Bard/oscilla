import { Fragment } from "react";
import { isArtistUri } from "../utils/tracklist";
import type { Credit } from "../types/tracklist";

export function ArtistLinks({
  artists,
  onOpen,
}: {
  artists: Credit[];
  onOpen: (uri: string) => void;
}) {
  return artists.map(({ name, uri }, index) => (
    <Fragment key={`${index}:${name}`}>
      {index > 0 && ", "}
      {isArtistUri(uri) ? (
        <button
          className="artist-link"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(uri);
          }}
          onDoubleClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {name}
        </button>
      ) : (
        name
      )}
    </Fragment>
  ));
}
