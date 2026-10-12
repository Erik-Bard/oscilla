import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

const [spotifyClientId, ...tauriBuildArgs] = process.argv.slice(2);

if (!spotifyClientId || spotifyClientId.startsWith("-")) {
  console.error(
    "Usage: node scripts/build.js <SPOTIFY_CLIENT_ID> [tauri build args]",
  );
  process.exit(1);
}

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const tauriCli = fileURLToPath(
  new URL("../node_modules/@tauri-apps/cli/tauri.js", import.meta.url),
);

const build = spawnSync(
  process.execPath,
  [tauriCli, "build", ...tauriBuildArgs],
  {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, SPOTIFY_CLIENT_ID: spotifyClientId },
  },
);

process.exit(build.status ?? 1);
