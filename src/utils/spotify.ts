import { invoke } from "@tauri-apps/api/core";
import {
  LONGEST_THROTTLE_WAITED_OUT_MS,
  throttlePauseMs,
} from "./freshness.ts";

export const API_ROOT = "https://api.spotify.com/v1";

let throttledUntil = 0;
let throttlesInARow = 0;

async function throttleHasPassed(): Promise<boolean> {
  const wait = throttledUntil - Date.now();
  if (wait <= 0) return true;
  if (wait > LONGEST_THROTTLE_WAITED_OUT_MS) return false;
  await new Promise((resolve) => setTimeout(resolve, wait));
  return throttleHasPassed();
}

function pauseEveryRequestIfThrottled(res: Response) {
  if (res.status !== 429) {
    throttlesInARow = 0;
    return false;
  }
  if (Date.now() >= throttledUntil)
    throttledUntil =
      Date.now() +
      throttlePauseMs(res.headers.get("Retry-After"), throttlesInARow++);
  return true;
}

export async function spotifyFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const call = async (forceRefresh: boolean) => {
    if (!(await throttleHasPassed()))
      return new Response(null, { status: 429 });
    const headers = new Headers(init.headers);
    headers.set(
      "Authorization",
      `Bearer ${await invoke<string>("access_token", { forceRefresh })}`,
    );
    return fetch(`${API_ROOT}${path}`, { ...init, headers });
  };
  let res = await call(false);
  if (res.status === 401) res = await call(true);
  if (pauseEveryRequestIfThrottled(res)) {
    res = await call(false);
    pauseEveryRequestIfThrottled(res);
  }
  return res;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await spotifyFetch(path);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

const inFlight = new Map<string, Promise<unknown>>();

export function getJson<T>(path: string): Promise<T> {
  let request = inFlight.get(path) as Promise<T> | undefined;
  if (!request) {
    request = fetchJson<T>(path).finally(() => inFlight.delete(path));
    inFlight.set(path, request);
  }
  return request;
}
