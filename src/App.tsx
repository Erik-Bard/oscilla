import "./App.css";
import { useSession } from "./session";
import { Wallpaper } from "./Wallpaper";

function SpotifyLogo() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"
      />
    </svg>
  );
}

function Landing() {
  const session = useSession();
  return (
    <div className="stage">
      <h1 className="wordmark">oscilla</h1>
      <p className="tagline">Your Spotify, tuned your way.</p>
      {session.status === "signingIn" ? (
        <div className="waiting" role="status">
          <p>Waiting for Spotify… finish signing in in your browser.</p>
          <button className="link" onClick={session.cancelSignIn}>
            Cancel
          </button>
        </div>
      ) : (
        <button className="spotify-button" onClick={session.signIn}>
          <SpotifyLogo />
          Sign in with Spotify
        </button>
      )}
      <p className="error" role="alert">
        {session.status === "signedOut" && session.error}
      </p>
    </div>
  );
}

function SignOutIcon() {
  return (
    <svg viewBox="0 0 256 256" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M120,216a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V40a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H56V208h56A8,8,0,0,1,120,216Zm109.66-93.66-40-40a8,8,0,0,0-11.32,11.32L204.69,120H112a8,8,0,0,0,0,16h92.69l-26.35,26.34a8,8,0,0,0,11.32,11.32l40-40A8,8,0,0,0,229.66,122.34Z"
      />
    </svg>
  );
}

function Home() {
  const session = useSession();
  if (session.status !== "signedIn") return null;
  const { listener } = session;
  return (
    <div className="stage">
      <div className="avatar-ring">
        {listener.imageUrl ? (
          <img className="avatar" src={listener.imageUrl} alt="" />
        ) : (
          <span className="avatar" aria-hidden="true">
            {listener.displayName.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <div>
        <p className="eyebrow">Welcome back</p>
        <h1 className="listener-name">{listener.displayName}</h1>
      </div>
      <button className="ghost-button" onClick={session.signOut}>
        <SignOutIcon />
        Sign out
      </button>
    </div>
  );
}

function App() {
  const { status } = useSession();
  return (
    <main>
      <Wallpaper />
      {status === "restoring" ? null : status === "signedIn" ? (
        <Home />
      ) : (
        <Landing />
      )}
    </main>
  );
}

export default App;
