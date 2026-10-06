# oscilla

A very opinionated music player

## Platform Support  

Oscilla currently supports **Windows only**: in-app playback relies on the Widevine DRM
available in WebView2, which the macOS and Linux webviews lack. 

## Spotify integration
Requires Spotify Premium.

## Develop

Requires Node and Rust ([Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)).

Create an app at [developer.spotify.com](https://developer.spotify.com/dashboard) with the
redirect URI `http://127.0.0.1:43821/callback`, add your account to its user list, then
provide its Client ID at build time, either in a `.env` file (see `.env.example`) or in the
environment:

```sh
SPOTIFY_CLIENT_ID=... npm run tauri build
```

```sh
npm install
npm run tauri dev    # run the app with hot reload
npm run tauri build  # build an installer
```

## License

This project is source-available for personal use. Redistribution and
distribution of modified versions are not permitted.

See [LICENSE](./LICENSE) for details.
