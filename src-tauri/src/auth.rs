use std::sync::Mutex as StdMutex;
use std::time::{Duration, Instant};

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD as B64;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, State, Url};
use tauri_plugin_opener::OpenerExt;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::Mutex;
use tokio::task::AbortHandle;

const CLIENT_ID: &str =
    include_str!(concat!(env!("OUT_DIR"), "/spotify_client_id"));
const PORT: u16 = 43821;
const REDIRECT_URI: &str = "http://127.0.0.1:43821/callback";
const SCOPES: &str = "user-read-private user-read-email user-read-playback-state \
    user-modify-playback-state user-read-currently-playing user-read-playback-position \
    user-read-recently-played user-top-read playlist-read-private playlist-read-collaborative \
    playlist-modify-private playlist-modify-public ugc-image-upload user-library-read \
    user-library-modify user-follow-read user-follow-modify streaming";
const TOKEN_URL: &str = "https://accounts.spotify.com/api/token";
const SIGN_IN_TIMEOUT: Duration = Duration::from_secs(5 * 60);
const REFRESH_MARGIN: Duration = Duration::from_secs(60);

const REVOKED: &str = "Please sign in again.";
const OFFLINE: &str =
    "Couldn't reach Spotify. Check your connection and try again.";
const CANCELLED: &str = "Sign-in cancelled.";

#[derive(Default)]
pub struct Auth {
    tokens: Mutex<Option<Tokens>>,
    pending: StdMutex<Option<AbortHandle>>,
}

struct Tokens {
    access: String,
    refresh: String,
    expires_at: Instant,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Listener {
    id: String,
    display_name: String,
    image_url: Option<String>,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    expires_in: u64,
    refresh_token: Option<String>,
}

#[derive(Deserialize)]
struct Me {
    id: String,
    display_name: Option<String>,
    #[serde(default)]
    images: Vec<Image>,
    product: Option<String>,
}

#[derive(Deserialize)]
struct Image {
    url: String,
}

#[tauri::command]
pub async fn restore_session(
    auth: State<'_, Auth>,
) -> Result<Option<Listener>, String> {
    let refresh = match keyring_entry()?.get_password() {
        Ok(token) => token,
        Err(keyring::Error::NoEntry) => return Ok(None),
        Err(e) => return Err(e.to_string()),
    };
    let tokens = refresh_tokens(&refresh).await?;
    start_session(&auth, tokens).await.map(Some)
}

#[tauri::command]
pub async fn sign_in(
    app: AppHandle,
    auth: State<'_, Auth>,
) -> Result<Listener, String> {
    cancel_pending(&auth);
    let task = tokio::spawn(sign_in_flow(app));
    *auth.pending.lock().unwrap() = Some(task.abort_handle());
    let tokens = match task.await {
        Ok(result) => result?,
        Err(e) if e.is_cancelled() => return Err(CANCELLED.into()),
        Err(e) => return Err(e.to_string()),
    };
    start_session(&auth, tokens).await
}

#[tauri::command]
pub fn cancel_sign_in(auth: State<'_, Auth>) {
    cancel_pending(&auth);
}

#[tauri::command]
pub async fn sign_out(auth: State<'_, Auth>) -> Result<(), String> {
    cancel_pending(&auth);
    *auth.tokens.lock().await = None;
    forget_refresh_token()
}

#[tauri::command]
pub async fn access_token(
    app: AppHandle,
    auth: State<'_, Auth>,
    force_refresh: bool,
) -> Result<String, String> {
    let mut guard = auth.tokens.lock().await;
    let tokens = guard.as_mut().ok_or("Not signed in.")?;
    if force_refresh || tokens.expires_at < Instant::now() + REFRESH_MARGIN {
        match refresh_tokens(&tokens.refresh).await {
            Ok(fresh) => *tokens = fresh,
            Err(e) => {
                if e == REVOKED {
                    *guard = None;
                    let _ = app.emit("session-ended", REVOKED);
                }
                return Err(e);
            }
        }
    }
    Ok(tokens.access.clone())
}

fn cancel_pending(auth: &Auth) {
    if let Some(task) = auth.pending.lock().unwrap().take() {
        task.abort();
    }
}

async fn start_session(
    auth: &Auth,
    tokens: Tokens,
) -> Result<Listener, String> {
    let me: Me = reqwest::Client::new()
        .get("https://api.spotify.com/v1/me")
        .bearer_auth(&tokens.access)
        .send()
        .await
        .map_err(|_| OFFLINE)?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    if me.product.as_deref() != Some("premium") {
        *auth.tokens.lock().await = None;
        forget_refresh_token()?;
        return Err("Oscilla requires Spotify Premium.".into());
    }
    keyring_entry()?
        .set_password(&tokens.refresh)
        .map_err(|e| e.to_string())?;
    *auth.tokens.lock().await = Some(tokens);
    Ok(Listener {
        display_name: me.display_name.unwrap_or_else(|| me.id.clone()),
        image_url: me.images.into_iter().next().map(|i| i.url),
        id: me.id,
    })
}

async fn sign_in_flow(app: AppHandle) -> Result<Tokens, String> {
    let verifier = B64.encode(rand::random::<[u8; 32]>());
    let state = B64.encode(rand::random::<[u8; 16]>());
    let listener = bind().await?;

    let mut url = Url::parse("https://accounts.spotify.com/authorize").unwrap();
    url.query_pairs_mut().extend_pairs([
        ("client_id", CLIENT_ID),
        ("response_type", "code"),
        ("redirect_uri", REDIRECT_URI),
        ("scope", SCOPES),
        ("state", &state),
        ("code_challenge_method", "S256"),
        ("code_challenge", &challenge(&verifier)),
    ]);
    app.opener()
        .open_url(url.as_str(), None::<&str>)
        .map_err(|_| "Couldn't open your browser for sign-in.")?;

    let code =
        tokio::time::timeout(SIGN_IN_TIMEOUT, receive_code(&listener, &state))
            .await
            .map_err(|_| "Sign-in timed out.")??;
    drop(listener);

    let res = token_request(&[
        ("grant_type", "authorization_code"),
        ("code", &code),
        ("redirect_uri", REDIRECT_URI),
        ("client_id", CLIENT_ID),
        ("code_verifier", &verifier),
    ])
    .await?;
    Ok(Tokens {
        refresh: res
            .refresh_token
            .ok_or("Spotify returned no refresh token.")?,
        access: res.access_token,
        expires_at: Instant::now() + Duration::from_secs(res.expires_in),
    })
}

async fn bind() -> Result<TcpListener, String> {
    // A just-cancelled attempt releases the port asynchronously.
    for _ in 0..20 {
        if let Ok(listener) = TcpListener::bind(("127.0.0.1", PORT)).await {
            return Ok(listener);
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    Err(format!("Port {PORT} is in use by another program."))
}

async fn receive_code(
    listener: &TcpListener,
    state: &str,
) -> Result<String, String> {
    loop {
        let Ok((mut socket, _)) = listener.accept().await else {
            continue;
        };
        let mut buf = [0u8; 4096];
        // Browsers open speculative connections that never send anything; don't wait on them.
        let Ok(Ok(n)) =
            tokio::time::timeout(Duration::from_secs(2), socket.read(&mut buf))
                .await
        else {
            continue;
        };
        let request = String::from_utf8_lossy(&buf[..n]);
        let Some(result) = parse_callback(&request, state) else {
            let _ = socket
                .write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
                .await;
            continue;
        };
        let message = match &result {
            Ok(_) => "Signed in. You can close this tab and return to Oscilla.",
            Err(e) => e.as_str(),
        };
        let body = format!(
            "<!doctype html><meta charset=utf-8><title>Oscilla</title>\
             <body style=\"font:16px system-ui;background:#0b0b10;color:#eee;display:grid;place-items:center;height:100vh;margin:0\">\
             <p>{message}</p>"
        );
        let _ = socket
            .write_all(
                format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                    body.len()
                )
                .as_bytes(),
            )
            .await;
        return result;
    }
}

fn parse_callback(
    request: &str,
    expected_state: &str,
) -> Option<Result<String, String>> {
    let target = request.lines().next()?.split(' ').nth(1)?;
    let url = Url::parse(&format!("http://127.0.0.1{target}")).ok()?;
    if url.path() != "/callback" {
        return None;
    }
    let param = |key: &str| {
        url.query_pairs()
            .find(|(k, _)| k == key)
            .map(|(_, v)| v.into_owned())
    };
    Some(if param("state").as_deref() != Some(expected_state) {
        Err("Sign-in failed: unexpected response. Please try again.".into())
    } else if let Some(error) = param("error") {
        Err(if error == "access_denied" {
            CANCELLED.into()
        } else {
            format!("Sign-in failed: {error}")
        })
    } else {
        param("code").ok_or_else(|| "Sign-in failed: no code returned.".into())
    })
}

fn challenge(verifier: &str) -> String {
    B64.encode(Sha256::digest(verifier.as_bytes()))
}

async fn refresh_tokens(refresh: &str) -> Result<Tokens, String> {
    let res = token_request(&[
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh),
        ("client_id", CLIENT_ID),
    ])
    .await;
    if res.as_ref().is_err_and(|e| e == REVOKED) {
        forget_refresh_token()?;
    }
    let res = res?;
    let refresh = match res.refresh_token {
        Some(rotated) => {
            keyring_entry()?
                .set_password(&rotated)
                .map_err(|e| e.to_string())?;
            rotated
        }
        None => refresh.to_owned(),
    };
    Ok(Tokens {
        access: res.access_token,
        refresh,
        expires_at: Instant::now() + Duration::from_secs(res.expires_in),
    })
}

async fn token_request(form: &[(&str, &str)]) -> Result<TokenResponse, String> {
    let res = reqwest::Client::new()
        .post(TOKEN_URL)
        .form(form)
        .send()
        .await
        .map_err(|_| OFFLINE)?;
    if res.status().is_client_error() {
        return Err(REVOKED.into());
    }
    res.error_for_status()
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())
}

fn keyring_entry() -> Result<keyring_core::Entry, String> {
    let (service, user) = ("com.erikbard.oscilla", "spotify-refresh-token");
    let entry =
        keyring::Entry::new(service, user).map_err(|e| e.to_string())?;
    if cfg!(windows) {
        keyring_core::Entry::new_with_modifiers(
            service,
            user,
            &[("persistence", "Local")].into_iter().collect(),
        )
        .map_err(|e| e.to_string())
    } else {
        Ok(entry.inner)
    }
}

fn forget_refresh_token() -> Result<(), String> {
    match keyring_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn challenge_matches_rfc7636_vector() {
        assert_eq!(
            challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }

    #[test]
    fn parses_callback() {
        let req = |q: &str| {
            format!("GET /callback?{q} HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n")
        };
        assert_eq!(
            parse_callback(&req("code=abc&state=s1"), "s1"),
            Some(Ok("abc".into()))
        );
        assert!(matches!(
            parse_callback(&req("code=abc&state=evil"), "s1"),
            Some(Err(_))
        ));
        assert_eq!(
            parse_callback(&req("error=access_denied&state=s1"), "s1"),
            Some(Err(CANCELLED.into()))
        );
        assert!(matches!(
            parse_callback(&req("state=s1"), "s1"),
            Some(Err(_))
        ));
        assert_eq!(
            parse_callback("GET /favicon.ico HTTP/1.1\r\n\r\n", "s1"),
            None
        );
    }
}
