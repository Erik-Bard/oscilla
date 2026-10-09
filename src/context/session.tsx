import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Listener } from "../types/session";

type SessionState =
  | { status: "restoring" }
  | { status: "signedOut"; error?: string }
  | { status: "signingIn" }
  | { status: "signedIn"; listener: Listener };

type Session = SessionState & {
  signIn: () => void;
  cancelSignIn: () => void;
  signOut: () => void;
};

const SessionContext = createContext<Session | null>(null);

let restoring: Promise<Listener | null> | undefined;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: "restoring" });

  useEffect(() => {
    restoring ??= invoke<Listener | null>("restore_session");
    restoring.then(
      (listener) =>
        setState(
          listener ? { status: "signedIn", listener } : { status: "signedOut" },
        ),
      (error: string) => setState({ status: "signedOut", error }),
    );
    const unlisten = listen<string>("session-ended", (e) =>
      setState({ status: "signedOut", error: e.payload }),
    );
    return () => void unlisten.then((f) => f());
  }, []);

  const session: Session = {
    ...state,
    signIn: () => {
      setState({ status: "signingIn" });
      invoke<Listener>("sign_in").then(
        (listener) => setState({ status: "signedIn", listener }),
        (error: string) => setState({ status: "signedOut", error }),
      );
    },
    cancelSignIn: () => void invoke("cancel_sign_in"),
    signOut: () => {
      void invoke("sign_out").finally(() => setState({ status: "signedOut" }));
    },
  };

  return <SessionContext value={session}>{children}</SessionContext>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session)
    throw new Error("useSession must be used inside SessionProvider");
  return session;
}
