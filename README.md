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
put its Client ID in a `.env` file (see `.env.example`).

```sh
npm install
npm run tauri dev    # run the app with hot reload
```

## Build a release

The Client ID is compiled into the binary, so the finished app needs no `.env` at runtime.
Pass it as the first argument to the build script:

```sh
node scripts/build.js <SPOTIFY_CLIENT_ID>
```

The build targets the machine it runs on and writes to `src-tauri/target/release/`:

- `oscilla.exe`: the standalone app
- `bundle/nsis/oscilla_<version>_x64-setup.exe`: the installer
- `bundle/msi/oscilla_<version>_x64_en-US.msi`: the MSI installer

Anything after the Client ID is forwarded to `tauri build`. To build only `oscilla.exe`
and skip the installers:

```sh
node scripts/build.js <SPOTIFY_CLIENT_ID> --no-bundle
```

## License

This project is source-available for personal use. Redistribution and
distribution of modified versions are not permitted.

See [LICENSE](./LICENSE) for details.
