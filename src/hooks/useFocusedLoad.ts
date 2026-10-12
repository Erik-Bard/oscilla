import { useEffect, useRef, useState } from "react";
import { isOlderThan, RELOAD_ON_FOCUS_AFTER_MS } from "../utils/freshness";

export type LoadState<T> =
  | { status: "loading" }
  | { status: "error"; reason: string }
  | { status: "ready"; value: T };

export function useFocusedLoad<T>(load: () => Promise<T>, key: unknown) {
  const [state, setState] = useState<LoadState<T>>({ status: "loading" });
  const latest = useRef(0);
  const loadedAt = useRef(0);

  const refresh = () => {
    const request = ++latest.current;
    loadedAt.current = Date.now();
    load().then(
      (value) => {
        if (request === latest.current) setState({ status: "ready", value });
      },
      (error: unknown) => {
        if (request === latest.current)
          setState((prev) =>
            prev.status === "ready"
              ? prev
              : { status: "error", reason: String(error) },
          );
      },
    );
  };

  useEffect(() => {
    refresh();
    const refreshIfStale = () => {
      if (isOlderThan(loadedAt.current, RELOAD_ON_FOCUS_AFTER_MS, Date.now()))
        refresh();
    };
    window.addEventListener("focus", refreshIfStale);
    return () => window.removeEventListener("focus", refreshIfStale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const retry = () => {
    setState({ status: "loading" });
    refresh();
  };

  return { state, retry };
}
