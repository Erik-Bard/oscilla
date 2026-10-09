import { invoke } from "@tauri-apps/api/core";

export const API_ROOT = "https://api.spotify.com/v1";

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
    return fetch(`${API_ROOT}${path}`, { ...init, headers });
  };
  const res = await call(false);
  return res.status === 401 ? call(true) : res;
}

export async function getJson<T>(path: string): Promise<T> {
  const res = await spotifyFetch(path);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}
