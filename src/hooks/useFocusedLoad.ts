import { useEffect, useRef, useState } from "react";

export type LoadState<T> =
  { status: "loading" } | { status: "error" } | { status: "ready"; value: T };

export function useFocusedLoad<T>(load: () => Promise<T>, key: unknown) {
  const [state, setState] = useState<LoadState<T>>({ status: "loading" });
  const latest = useRef(0);

  const refresh = () => {
    const request = ++latest.current;
    load().then(
      (value) => {
        if (request === latest.current) setState({ status: "ready", value });
      },
      () => {
        if (request === latest.current)
          setState((prev) =>
            prev.status === "ready" ? prev : { status: "error" },
          );
      },
    );
  };

  useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const retry = () => {
    setState({ status: "loading" });
    refresh();
  };

  return { state, retry, refresh };
}
