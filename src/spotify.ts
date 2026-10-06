import { invoke } from "@tauri-apps/api/core";

export async function spotifyFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const call = async (forceRefresh: boolean) => {
    const headers = new Headers(init.headers);
    headers.set(
      "Authorization",
      `Bearer ${await invoke<string>("access_token", { forceRefresh })}`,
    );
    return fetch(`https://api.spotify.com/v1${path}`, { ...init, headers });
  };
  const res = await call(false);
  return res.status === 401 ? call(true) : res;
}
