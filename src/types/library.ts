export type LibraryItem = {
  uri: string;
  kind: "likedSongs" | "playlist" | "album";
  name: string;
  typeLabel: string;
  by: string;
  imageUrl: string | null;
};
