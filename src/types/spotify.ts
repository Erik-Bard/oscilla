export type ApiLibraryPlaylist = {
  uri: string;
  name: string;
  images: SpotifyImage[] | null;
  collaborative: boolean;
  owner: { id: string; display_name: string | null };
} | null;

export type ApiSavedAlbum = {
  album: {
    uri: string;
    name: string;
    album_type: string;
    images: SpotifyImage[];
    artists: ApiArtistRef[];
  };
};

export type ApiArtistRef = { name: string; uri?: string | null };

export type ApiArtist = { uri: string; name: string; images: SpotifyImage[] };

export type ApiArtistAlbum = {
  uri: string;
  name: string;
  album_type: string;
  release_date: string;
  images: SpotifyImage[];
};

export type SpotifyImage = { url: string; width: number | null };

export type Play = {
  played_at: string;
  context: { type: string; uri: string } | null;
  track: {
    album: {
      uri: string;
      name: string;
      album_type: string;
      images: SpotifyImage[];
      artists: ApiArtistRef[];
    };
  };
};

export type ApiTrack = {
  uri: string;
  name: string;
  duration_ms: number;
  is_playable?: boolean;
  is_local?: boolean;
  artists?: ApiArtistRef[];
  show?: { name: string };
  album?: { name: string; images: SpotifyImage[] };
  images?: SpotifyImage[];
};

export type PlaylistEntry = {
  added_at: string | null;
  is_local?: boolean;
  track?: ApiTrack | null;
  item?: ApiTrack | null;
};

export type ApiPage<T> = { items: T[]; next: string | null; total: number };

export type ApiAlbum = {
  name: string;
  album_type: string;
  release_date: string;
  images: SpotifyImage[];
  artists: ApiArtistRef[];
  tracks: ApiPage<ApiTrack>;
};

export type ApiPlaylist = {
  name: string;
  snapshot_id?: string;
  public: boolean | null;
  images: SpotifyImage[] | null;
  owner: { id: string; display_name: string | null };
  tracks?: ApiPage<PlaylistEntry>;
  items?: ApiPage<PlaylistEntry>;
};

export type ApiSavedTracks = ApiPage<{ added_at: string; track: ApiTrack }>;
